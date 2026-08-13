import { env } from '../env.js';
import { HttpError } from '../lib/http.js';

/**
 * QPay v2 merchant API.
 *
 * Урсгал: auth/token → invoice → (хэрэглэгч банкны аппаар төлнө) →
 * payment/check-ээр баталгаажуулна. Клиентээс ирсэн "төлсөн" гэдэгт итгэхгүй.
 */

type TokenResponse = {
  access_token: string;
  expires_in?: number;
};

export type QPayInvoice = {
  invoice_id: string;
  qr_text?: string;
  qr_image?: string;
  qPay_shortUrl?: string;
  urls?: { name: string; description?: string; logo?: string; link: string }[];
};

export type QPayPaymentRow = {
  payment_id: string;
  payment_status: string; // NEW | FAILED | PAID | REFUNDED
  payment_amount: string;
  payment_currency?: string;
  payment_date?: string;
};

export type QPayCheckResult = {
  count: number;
  paid_amount: number;
  rows: QPayPaymentRow[];
};

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  // 60 секундын нөөцтэй — хугацаа дуусахын алдын шинэчилнэ.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const basic = Buffer.from(`${env.qpay.username}:${env.qpay.password}`).toString('base64');
  const res = await fetch(`${env.qpay.baseUrl}/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new HttpError(502, `QPay нэвтрэлт амжилтгүй (${res.status})`);
  }

  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) throw new HttpError(502, 'QPay токен буцаасангүй');

  cached = {
    token: data.access_token,
    // expires_in нь заримдаа unix timestamp-аар ирдэг — хоёуланг нь зохицуулна.
    expiresAt: normalizeExpiry(data.expires_in),
  };
  return cached.token;
}

function normalizeExpiry(expiresIn?: number): number {
  if (!expiresIn) return Date.now() + 10 * 60_000;
  // 10 оронтой тоо = unix секунд (2001 оноос хойш), эс бөгөөс "хэдэн секундын дараа".
  return expiresIn > 1_000_000_000 ? expiresIn * 1000 : Date.now() + expiresIn * 1000;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${env.qpay.baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    // Токен хүчингүй болсон байж магадгүй — дараагийн дуудлагад шинээр авна.
    if (res.status === 401) cached = null;
    throw new HttpError(502, `QPay алдаа (${res.status}): ${text.slice(0, 200)}`);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

/** Нэхэмжлэх үүсгэнэ. `amount` нь ЗӨВХӨН серверийн тооцоолсон дүн. */
export function createInvoice(input: {
  paymentId: string;
  amount: number;
  description: string;
  receiverCode: string;
  callbackUrl: string;
}): Promise<QPayInvoice> {
  return call<QPayInvoice>('/invoice', {
    invoice_code: env.qpay.invoiceCode,
    // Манай талын давтагдашгүй дугаар — тохируулахад ашиглана.
    sender_invoice_no: input.paymentId,
    invoice_receiver_code: input.receiverCode,
    invoice_description: input.description,
    amount: input.amount,
    callback_url: input.callbackUrl,
  });
}

/** Нэхэмжлэхийн төлбөрийг шалгана. Энэ бол баталгаажуулалтын цорын ганц эх сурвалж. */
export function checkPayment(invoiceId: string): Promise<QPayCheckResult> {
  return call<QPayCheckResult>('/payment/check', {
    object_type: 'INVOICE',
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  });
}
