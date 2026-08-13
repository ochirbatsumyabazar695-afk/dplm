import type { Payment, PaymentProvider } from '@prisma/client';
import { prisma } from '../db.js';
import { PAYMENT_SETUP_HINT, env, qpayConfigured, stripeConfigured, wireConfigured } from '../env.js';
import { HttpError, badRequest, notFound } from '../lib/http.js';
import * as qpay from './qpay.js';
import * as stripe from './stripe.js';
import * as wire from './wire.js';

/** Клиент рүү буцаах хэлбэр — дотоод талбаруудыг задлахгүй. */
export function publicPayment(p: Payment, order?: { orderNo: number; trackToken: string } | null) {
  return {
    id: p.id,
    provider: p.provider,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    invoiceId: p.invoiceId,
    checkoutUrl: p.paymentUrl,
    qrText: p.qrText,
    qrImage: p.qrImage,
    paidAt: p.paidAt,
    orderNo: order?.orderNo ?? null,
    trackToken: order?.trackToken ?? null,
  };
}

export function orderRefOf(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNo: true, trackToken: true },
  });
}

export function assertProviderReady(provider: PaymentProvider) {
  if (provider === 'QPAY' && !qpayConfigured) throw new HttpError(503, PAYMENT_SETUP_HINT);
  if (provider === 'STRIPE' && !stripeConfigured) throw new HttpError(503, PAYMENT_SETUP_HINT);
  if (provider === (('WIRE' as unknown) as PaymentProvider) && !wireConfigured) throw new HttpError(503, PAYMENT_SETUP_HINT);
}

export async function createPayment(orderId: string, tenantId: string, provider: PaymentProvider) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    select: {
      id: true,
      orderNo: true,
      total: true,
      isPaid: true,
      userId: true,
      customerPhone: true,
      tenant: { select: { slug: true } },
    },
  });
  if (!order) throw notFound('Захиалга олдсонгүй');
  if (order.isPaid) throw badRequest('Энэ захиалга аль хэдийн төлөгдсөн байна');

  assertProviderReady(provider);

  const existing = await prisma.payment.findFirst({
    where: { orderId: order.id, provider, status: 'PENDING' },
  });
  if (existing) return existing;

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      orderId: order.id,
      userId: order.userId,
      provider,
      amount: order.total,
      currency: provider === 'STRIPE' ? env.stripe.currency.toUpperCase() : 'MNT',
    },
  });

  try {
    if (provider === 'QPAY') {
      return await startQpay(payment, order.orderNo, order.customerPhone);
    } else if (provider === ('WIRE' as any)) {
      return await startWire(payment, order.orderNo);
    } else {
      return await startStripe(payment, order.orderNo, order.tenant.slug);
    }
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    throw e;
  }
}

async function startQpay(payment: Payment, orderNo: number, phone: string) {
  const invoice = await qpay.createInvoice({
    paymentId: payment.id,
    amount: payment.amount,
    description: `Захиалга #${orderNo}`,
    receiverCode: phone,
    callbackUrl: `${env.publicApiUrl}/api/payments/qpay/callback?payment=${payment.id}`,
  });

  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      invoiceId: invoice.invoice_id,
      qrText: invoice.qr_text ?? null,
      qrImage: invoice.qr_image ?? null,
      paymentUrl: invoice.qPay_shortUrl ?? null,
    },
  });
}

async function startWire(payment: Payment, orderNo: number) {
  const intent = await wire.createWirePaymentIntent(
    payment.id,
    payment.amount,
    `Masteurent Захиалга #${orderNo}`,
  );

  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      invoiceId: intent.id,
      paymentUrl: `https://checkout.wire.mn/pay/${intent.client_secret}`,
    },
  });
}

async function startStripe(payment: Payment, orderNo: number, slug: string) {
  const back = `${env.webOrigin}/t/${slug}/pay/${payment.id}`;
  const session = await stripe.createCheckoutSession({
    paymentId: payment.id,
    amount: payment.amount,
    description: `Захиалга #${orderNo}`,
    successUrl: `${back}?done=1`,
    cancelUrl: `${back}?cancelled=1`,
  });

  return prisma.payment.update({
    where: { id: payment.id },
    data: { invoiceId: session.id, paymentUrl: session.url ?? null },
  });
}

import { emitOrder, emitTenant } from '../realtime.js';

export async function markPaid(paymentId: string, transactionId: string | null) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound('Төлбөр олдсонгүй');
  if (payment.status === 'PAID') return payment;

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'PAID', transactionId, paidAt: new Date() },
    });
    if (!claimed.count) return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.order.update({ where: { id: payment.orderId }, data: { isPaid: true } });
    return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  });

  emitTenant(payment.tenantId, 'payment:paid', { paymentId: payment.id, orderId: payment.orderId, amount: payment.amount });
  emitOrder(payment.orderId, 'order:paid', { isPaid: true });

  return result;
}


export async function syncQpay(payment: Payment): Promise<Payment> {
  if (payment.status === 'PAID' || !payment.invoiceId) return payment;

  const result = await qpay.checkPayment(payment.invoiceId);
  const paidRow = result.rows?.find((r) => r.payment_status?.toUpperCase() === 'PAID');

  if (!paidRow || (result.paid_amount ?? 0) < payment.amount) return payment;

  return markPaid(payment.id, paidRow.payment_id ?? null);
}

export async function syncWire(payment: Payment): Promise<Payment> {
  if (payment.status === 'PAID' || !payment.invoiceId) return payment;

  const intent = await wire.getWirePaymentIntent(payment.invoiceId);
  if (intent.status === 'succeeded') {
    return markPaid(payment.id, intent.id);
  }

  return payment;
}

export async function syncStripe(payment: Payment): Promise<Payment> {
  if (payment.status === 'PAID' || !payment.invoiceId) return payment;

  try {
    const session = await stripe.stripeClient().checkout.sessions.retrieve(payment.invoiceId);
    if (session.payment_status === 'paid') {
      const txId = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;
      return markPaid(payment.id, txId);
    }
  } catch (e) {
    console.error('syncStripe error:', e);
  }

  return payment;
}


export const availableProviders = () => ({
  qpay: qpayConfigured,
  stripe: stripeConfigured,
  wire: wireConfigured,
});

