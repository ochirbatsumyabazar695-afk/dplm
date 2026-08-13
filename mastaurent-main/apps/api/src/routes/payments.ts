import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { stripeConfigured } from '../env.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { orderLimiter } from '../lib/rateLimit.js';
import { optionalMember } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import {
  availableProviders,
  createPayment,
  markPaid,
  orderRefOf,
  publicPayment,
  syncQpay,
  syncWire,
  syncStripe,
} from '../payments/service.js';

import { verifyWebhook } from '../payments/stripe.js';

export const paymentsRouter = Router();

/** Аль төлбөрийн хэрэгсэл идэвхтэй байгааг frontend мэдэх хэрэгтэй. */
paymentsRouter.get('/providers', (_req, res) => res.json(availableProviders()));

const createSchema = z.object({
  orderId: z.string().min(1, 'Захиалга заагаагүй байна'),
  provider: z.enum(['QPAY', 'STRIPE', 'WIRE']),
});

/**
 * Төлбөр эхлүүлэх. Дүн нь захиалгаас уншигдана.
 */
paymentsRouter.post(
  '/create',
  orderLimiter,
  resolveTenant,
  optionalMember,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const payment = await createPayment(body.orderId, req.tenantId!, body.provider as any);
    res.status(201).json({ payment: publicPayment(payment, await orderRefOf(payment.orderId)) });
  }),
);

/**
 * Төлбөрийн төлөв. QPay эсвэл Wire бол эх сурвалжаас нь дахин шалгана.
 */
paymentsRouter.get(
  '/:id',
  resolveTenant,
  asyncHandler(async (req, res) => {
    const found = await prisma.payment.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
    });
    if (!found) throw notFound('Төлбөр олдсонгүй');

    let payment = found;
    if (found.provider === 'QPAY') {
      payment = await syncQpay(found);
    } else if (found.provider === ('WIRE' as any)) {
      payment = await syncWire(found);
    } else if (found.provider === 'STRIPE') {
      payment = await syncStripe(found);
    }
    res.json({ payment: publicPayment(payment, await orderRefOf(payment.orderId)) });
  }),
);



/**
 * QPay callback. Биед нь итгэхгүй — зөвхөн "шалгаарай" гэсэн дохио
 * гэж үзээд payment/check API-аар баталгаажуулна.
 */
const qpayCallback = asyncHandler(async (req, res) => {
  const paymentId = (req.query.payment as string | undefined) ?? '';
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound('Төлбөр олдсонгүй');

  await syncQpay(payment);
  res.json({ ok: true });
});

paymentsRouter.get('/qpay/callback', qpayCallback);
paymentsRouter.post('/qpay/callback', qpayCallback);

/**
 * Stripe webhook. Гарын үсгээр баталгаажуулна — index.ts дээр энэ зам
 * түүхий биетэйгээр (express.raw) ирдэг.
 */
paymentsRouter.post(
  '/stripe/webhook',
  asyncHandler(async (req, res) => {
    if (!stripeConfigured) throw badRequest('Stripe тохируулаагүй байна');

    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') throw badRequest('Гарын үсэг алга');
    if (!Buffer.isBuffer(req.body)) throw badRequest('Түүхий бие шаардлагатай');

    let event;
    try {
      event = verifyWebhook(req.body, signature);
    } catch {
      // Гарын үсэг таарахгүй бол хуурамч хүсэлт.
      throw badRequest('Гарын үсэг буруу байна');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        client_reference_id?: string | null;
        payment_status?: string;
        payment_intent?: string | null;
      };
      const paymentId = session.client_reference_id;
      if (paymentId && session.payment_status === 'paid') {
        // Сүбскрипшний session-ы client_reference_id нь рестораны хүсэлтийн
        // id — `payments` дотор мөр байхгүй. Тэр тохиолдолд чимээгүй өнгөрнө,
        // эс бол Stripe 404 аваад webhook-оо дахин дахин илгээнэ.
        const exists = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (exists) await markPaid(paymentId, session.payment_intent ?? null);
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as { client_reference_id?: string | null };
      if (session.client_reference_id) {
        await prisma.payment.updateMany({
          where: { id: session.client_reference_id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      }
    }

    res.json({ received: true });
  }),
);
