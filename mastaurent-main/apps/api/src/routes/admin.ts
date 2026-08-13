import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requirePlatformAdmin } from '../middleware/auth.js';

/**
 * Платформын админы удирдлага.
 * Бүх зам `requirePlatformAdmin`-аар хамгаалагдсан — рестораны эзэн ч энд орохгүй.
 */
export const adminRouter = Router();

adminRouter.use(requirePlatformAdmin);

/** Бүх хэрэглэгч + аль ресторанд ямар эрхтэйг нь хамт. */
adminRouter.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    const search = (req.query.q as string | undefined)?.trim();

    const accounts = await prisma.account.findMany({
      where: search
        ? {
            // Postgres дээр `contains` нь LIKE — том/жижиг үсэг ЯЛГАНА.
            // MySQL-ийн collation ялгадаггүй байсан тул энэ нь заавал.
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isPlatformAdmin: true,
        isBlocked: true,
        createdAt: true,
        memberships: {
          select: { role: true, tenant: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    res.json({ accounts });
  }),
);

const blockSchema = z.object({ isBlocked: z.boolean() });
adminRouter.patch('/accounts/:id/block', asyncHandler(async (req, res) => {
  const { isBlocked } = blockSchema.parse(req.body);
  if (req.params.id === req.account!.id && isBlocked) throw badRequest('Өөрийн дансыг блоклох боломжгүй');
  const { count } = await prisma.account.updateMany({ where: { id: req.params.id }, data: { isBlocked, tokenVersion: { increment: 1 } } });
  if (!count) throw notFound('Хэрэглэгч олдсонгүй');
  res.json({ ok: true });
}));

/** Бүх ресторан — идэвхгүй болсныг ч оруулна. */
adminRouter.get(
  '/tenants',
  asyncHandler(async (_req, res) => {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        logoUrl: true,
        accentColor: true,
        isActive: true,
        createdAt: true,
        _count: { select: { menuItems: true, orders: true, users: true } },
        users: {
          where: { role: 'DIRECTOR' },
          take: 1,
          select: { name: true, email: true },
        },
      },
    });
    res.json({ tenants });
  }),
);

const activeSchema = z.object({ isActive: z.boolean() });

/**
 * Ресторан идэвхжүүлэх / идэвхгүй болгох.
 * Идэвхгүй ресторан нийтэд харагдахгүй, storefront нь хаалттай болно.
 */
adminRouter.patch(
  '/tenants/:id/active',
  asyncHandler(async (req, res) => {
    const { isActive } = activeSchema.parse(req.body);
    const { count } = await prisma.tenant.updateMany({
      where: { id: req.params.id },
      data: { isActive },
    });
    if (!count) throw notFound('Ресторан олдсонгүй');

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, isActive: true },
    });
    res.json({ tenant });
  }),
);

/**
 * Ресторан устгах. Түүнд хамаарах бүх өгөгдөл (цэс, захиалга, ширээ) хамт
 * устна — тиймээс идэвхгүй болгохыг илүүд үзнэ.
 */
adminRouter.delete(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { orders: true } } },
    });
    if (!tenant) throw notFound('Ресторан олдсонгүй');

    // Захиалгын түүхтэй ресторныг санамсаргүй устгахаас сэргийлнэ.
    if (tenant._count.orders > 0 && req.query.force !== 'true') {
      throw badRequest(
        `Энэ ресторан ${tenant._count.orders} захиалгатай. Идэвхгүй болгох нь зөв — ` +
          'үнэхээр устгах бол ?force=true нэмнэ үү.',
      );
    }

    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

/** Платформын товч тоо баримт. */
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [accounts, tenants, activeTenants, pendingRequests, orders, reservations, gmv] =
      await Promise.all([
        prisma.account.count(),
        prisma.tenant.count(),
        prisma.tenant.count({ where: { isActive: true } }),
        prisma.restaurantRequest.count({ where: { status: 'PENDING' } }),
        prisma.order.count(),
        prisma.reservation.count(),
        prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { total: true } }),
      ]);

    res.json({ accounts, tenants, activeTenants, pendingRequests, orders, reservations, gmv: gmv._sum.total ?? 0 });
  }),
);
