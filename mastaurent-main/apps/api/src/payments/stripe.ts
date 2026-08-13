import Stripe from 'stripe';
import { env } from '../env.js';

/**
 * Stripe Checkout — нөөц сонголт.
 *
 * Анхаар: Stripe-ийн merchant данс Монголд албан ёсоор дэмжигдээгүй тул
 * энэ нь дипломын демо/test mode-д зориулагдсан. Production-д шилжихээс
 * өмнө тухайн байгууллага Stripe данс нээх эрхтэй эсэхийг шалгана.
 */

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  client ??= new Stripe(env.stripe.secretKey);
  return client;
}

/** Stripe дүнг хамгийн жижиг нэгжээр авдаг. Тэг аравтын валютууд онцгой. */
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

export function toMinorUnit(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency) ? amount : amount * 100;
}

export async function createCheckoutSession(input: {
  paymentId: string;
  amount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripeClient().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripe.currency,
          unit_amount: toMinorUnit(input.amount, env.stripe.currency),
          product_data: { name: input.description },
        },
      },
    ],
    // Webhook ирэхэд аль төлбөр болохыг үүгээр таана.
    client_reference_id: input.paymentId,
    metadata: { paymentId: input.paymentId },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
}

/**
 * Webhook-ийн гарын үсгийг шалгана. Гарын үсэггүй биетэд итгэвэл
 * хэн ч "төлөгдсөн" гэсэн хүсэлт явуулж чадна.
 */
export function verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
  return stripeClient().webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}
