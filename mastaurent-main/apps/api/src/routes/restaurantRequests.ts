import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireAccount, requirePlatformAdmin } from '../middleware/auth.js';
import { createCheckoutSession, stripeClient } from '../payments/stripe.js';
import { createWirePaymentIntent, getWirePaymentIntent } from '../payments/wire.js';

export const requestsRouter = Router();




const publicRequest = {
  id: true,
  name: true,
  slug: true,
  category: true,
  tagline: true,
  description: true,
  phone: true,
  email: true,
  address: true,
  openTime: true,
  closeTime: true,
  logoUrl: true,
  coverUrl: true,
  accentColor: true,
  note: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  tenantId: true,
  createdAt: true,
} as const;

const withAccount = {
  ...publicRequest,
  account: { select: { id: true, name: true, email: true, phone: true } },
} as const;

const createSchema = z.object({
  name: z.string().min(2, 'Рестораны нэр хамгийн багадаа 2 тэмдэгт').max(80),
  slug: z
    .string()
    .min(3, 'Хаяг хамгийн багадаа 3 тэмдэгт')
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Хаяг зөвхөн жижиг латин үсэг, тоо, зураасаас тогтоно'),
  category: z.string().max(60).optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(1000).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('И-мэйл буруу байна').optional().or(z.literal('')),
  address: z.string().max(200).optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Цаг HH:MM хэлбэртэй').default('09:00'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Цаг HH:MM хэлбэртэй').default('22:00'),
  logoUrl: z.string().max(600).optional().or(z.literal('')),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Өнгө #RRGGBB хэлбэртэй байна')
    .default('#0A0A0A'),
  plan: z.enum(['BASIC', 'PREMIUM', 'FRANCHISE']).default('BASIC'),
  note: z.string().max(600).optional(),
});

/** Хаяг чөлөөтэй эсэх — одоо байгаа ресторан болон хүлээгдэж буй хүсэлтээс. */
async function assertSlugFree(slug: string, exceptRequestId?: string) {
  const taken = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (taken) throw badRequest('Энэ хаяг аль хэдийн ашиглагдаж байна');

  const pending = await prisma.restaurantRequest.findFirst({
    where: { slug, status: 'PENDING', ...(exceptRequestId ? { id: { not: exceptRequestId } } : {}) },
    select: { id: true },
  });
  if (pending) throw badRequest('Энэ хаягаар хүсэлт аль хэдийн илгээгдсэн байна');
}

async function approveRequestAndCreateTenant(request: {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  openTime: string;
  closeTime: string;
  logoUrl: string | null;
  coverUrl: string | null;
  accentColor: string;
  plan: any;
  monthlyFee: number;
  accountId: string;
  account: { name: string; email: string; phone: string | null };
}) {
  await assertSlugFree(request.slug, request.id);
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: request.slug,
        name: request.name,
        category: request.category,
        tagline: request.tagline,
        description: request.description,
        phone: request.phone,
        address: request.address,
        openTime: request.openTime,
        closeTime: request.closeTime,
        logoUrl: request.logoUrl,
        coverUrl: request.coverUrl,
        accentColor: request.accentColor,
        plan: request.plan,
        monthlyFee: request.monthlyFee,
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.user.create({
      data: {
        tenantId: tenant.id,
        accountId: request.accountId,
        name: request.account.name,
        email: request.account.email,
        phone: request.account.phone,
        role: 'DIRECTOR',
      },
    });

    await tx.restaurantRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', tenantId: tenant.id, reviewedAt: new Date() },
    });

    return tenant;
  });
}

// --- Хэрэглэгчийн тал ---------------------------------------------------------

/** Ресторан хүсэлт үүсгэж, Wire төлбөрийн нэхэмжлэх бэлтгэнэ. */
requestsRouter.post(
  '/',
  requireAccount,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const accountId = req.account!.id;

    const owned = await prisma.user.findFirst({
      where: { accountId, role: 'DIRECTOR', isActive: true },
      select: { id: true },
    });
    if (owned) throw badRequest('Та аль хэдийн ресторантай байна');

    await assertSlugFree(body.slug);

    const fee = body.plan === 'FRANCHISE' ? 350000 : body.plan === 'PREMIUM' ? 150000 : 50000;

    // Хүсэлтийг Stripe session-ЭЭС ӨМНӨ үүсгэнэ.
    //
    // Урвуугаар нь хийвэл session амжилттай үүсээд мөр үүсгэх алхам уначихвал
    // хэрэглэгч төлчихөөд, тэр төлбөр нь ямар ч хүсэлттэй холбогдоогүй үлдэнэ
    // — DB дээр огт ул мөргүй. Сүбскрипшнд `payments` мөр үүсгэдэггүй тул
    // (Payment.orderId заавал шаарддаг) хүсэлтийн мөр л ганц бүртгэл болно.
    const created = await prisma.restaurantRequest.create({
      data: { ...body, monthlyFee: fee, accountId, status: 'PENDING' },
      select: { id: true },
    });

    let checkoutUrl: string | null = null;
    try {
      const back = `${env.webOrigin}/restaurant-request`;
      const session = await createCheckoutSession({
        // Хүсэлтийн жинхэнэ id — Stripe-ийн client_reference_id болно.
        // Ингэснээр гүйлгээ Stripe талаас ч хүсэлт рүүгээ мөрдөгдөнө.
        paymentId: created.id,
        amount: fee,
        description: `Masteurent Сүбскрипшн (${body.plan}) - ${body.name}`,
        successUrl: `${back}?success=1`,
        cancelUrl: `${back}?cancelled=1`,
      });
      checkoutUrl = session.url ?? null;
      await prisma.restaurantRequest.update({
        where: { id: created.id },
        data: { note: `STRIPE:${session.id}|${checkoutUrl}` },
      });
    } catch (e) {
      // Session үүсээгүй ч хүсэлт PENDING-ээр үлдэнэ — админ гараар
      // зөвшөөрч болно, харин мөнгө алга болохгүй.
      console.error('Stripe subscription session creation failed:', e);
    }

    const request = await prisma.restaurantRequest.findUniqueOrThrow({
      where: { id: created.id },
      select: publicRequest,
    });

    res.status(201).json({ request, checkoutUrl });
  }),
);



/** Өөрийн хүсэлтүүд. */
requestsRouter.get(
  '/mine',
  requireAccount,
  asyncHandler(async (req, res) => {
    const requests = await prisma.restaurantRequest.findMany({
      where: { accountId: req.account!.id },
      orderBy: { createdAt: 'desc' },
      select: publicRequest,
    });
    res.json({ requests });
  }),
);

// --- Платформын админ ---------------------------------------------------------

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']).optional(),
});

requestsRouter.get(
  '/',
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const { status } = listQuerySchema.parse(req.query);
    const requests = await prisma.restaurantRequest.findMany({
      where: status && status !== 'ALL' ? { status } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: withAccount,
    });
    res.json({ requests });
  }),
);

/**
 * Зөвшөөрөх — ресторан үүсгээд хүсэлт гаргагчийг OWNER болгоно.
 * Бүх алхам нэг transaction дотор: аль нэг нь унавал юу ч үлдэхгүй.
 */
requestsRouter.post(
  '/:id/approve',
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const request = await prisma.restaurantRequest.findUnique({
      where: { id: req.params.id },
      include: { account: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!request) throw notFound('Хүсэлт олдсонгүй');
    if (request.status !== 'PENDING') throw badRequest('Энэ хүсэлт аль хэдийн хянагдсан байна');

    const tenant = await approveRequestAndCreateTenant(request);
    res.json({ tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } });
  }),
);

/** Wire Төлбөр шалгах & Идэвхжүүлэх */
requestsRouter.post(
  '/:id/verify-payment',
  requireAccount,
  asyncHandler(async (req, res) => {
    const request = await prisma.restaurantRequest.findFirst({
      where: { id: req.params.id, accountId: req.account!.id },
      include: { account: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!request) throw notFound('Хүсэлт олдсонгүй');

    if (request.status === 'APPROVED' && request.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: request.tenantId } });
      return res.json({ status: 'APPROVED', tenant });
    }

    if (request.note?.startsWith('STRIPE:')) {
      const parts = request.note.split('|');
      const sessionId = parts[0].replace('STRIPE:', '');
      try {
        const session = await stripeClient().checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
          const tenant = await approveRequestAndCreateTenant(request);
          return res.json({ status: 'APPROVED', tenant });
        }
      } catch (e) {
        console.error('Stripe payment verify error:', e);
      }
    }

    if (request.note?.startsWith('WIRE:')) {
      const parts = request.note.split('|');
      const intentId = parts[0].replace('WIRE:', '');
      try {
        const intent = await getWirePaymentIntent(intentId);
        if (intent.status === 'succeeded') {
          const tenant = await approveRequestAndCreateTenant(request);
          return res.json({ status: 'APPROVED', tenant });
        }
      } catch (e) {
        console.error('Wire payment check error:', e);
      }
    }


    res.json({ status: request.status, message: 'Төлбөр хараахан баталгаажаагүй байна' });
  }),
);


const rejectSchema = z.object({
  reviewNote: z.string().min(3, 'Шалтгаанаа бичнэ үү').max(600),
});

requestsRouter.post(
  '/:id/reject',
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const { reviewNote } = rejectSchema.parse(req.body);

    const { count } = await prisma.restaurantRequest.updateMany({
      where: { id: req.params.id, status: 'PENDING' },
      data: { status: 'REJECTED', reviewNote, reviewedAt: new Date() },
    });
    if (!count) throw notFound('Хянагдаагүй хүсэлт олдсонгүй');

    const request = await prisma.restaurantRequest.findUnique({
      where: { id: req.params.id },
      select: publicRequest,
    });
    res.json({ request });
  }),
);
