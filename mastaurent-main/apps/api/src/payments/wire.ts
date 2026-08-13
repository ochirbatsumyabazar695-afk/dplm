import { env, wireConfigured } from '../env.js';

export interface WirePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  description?: string;
  status: 'requires_payment_method' | 'processing' | 'succeeded' | 'canceled';
  client_secret: string;
  livemode: boolean;
  expires_at?: number;
}

/**
 * Create a PaymentIntent on Wire (Unified Mongolian Payment Gateway)
 * API Base: https://api.wire.mn/v1
 */
export async function createWirePaymentIntent(
  orderId: string,
  amount: number,
  description: string,
): Promise<WirePaymentIntent> {
  if (!wireConfigured) {
    throw new Error('WIRE_SECRET_KEY тохируулаагүй байна.');
  }

  const response = await fetch('https://api.wire.mn/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.wire.secretKey}`,
      'Idempotency-Key': `ik_${orderId}_${Date.now()}`,
    },
    body: JSON.stringify({
      amount: Math.round(amount),
      currency: 'MNT',
      description,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Wire API Error ${response.status}]: ${errorText}`);
  }

  return (await response.json()) as WirePaymentIntent;
}

/**
 * Retrieve PaymentIntent status from Wire
 */
export async function getWirePaymentIntent(paymentIntentId: string): Promise<WirePaymentIntent> {
  if (!wireConfigured) {
    throw new Error('WIRE_SECRET_KEY тохируулаагүй байна.');
  }

  const response = await fetch(`https://api.wire.mn/v1/payment_intents/${paymentIntentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.wire.secretKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[Wire API Error ${response.status}]: ${errorText}`);
  }

  return (await response.json()) as WirePaymentIntent;
}
