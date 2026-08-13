import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../env.js';

/** Алдааг бусад endpoint-тэй ижил хэлбэрээр буцаана. */
const handler: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({ message: options.message as string });
};

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
} as const;

/** Нэвтрэлт — нууц үг болон SMS код таах оролдлогыг хязгаарлана. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  // Хөгжүүлэлтийн үед демо бүртгэлүүдийг байнга туршдаг тул илүү өгөөмөр.
  // Production дээр л хатуу хязгаар хэрэгтэй.
  limit: env.isProd ? 20 : 200,
  message: 'Хэт олон оролдлого. 15 минутын дараа дахин оролдоно уу.',
});

/** Захиалга үүсгэх — spam-аас хамгаална. */
export const orderLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 10,
  message: 'Хэт олон захиалга. Түр хүлээгээд дахин оролдоно уу.',
});

/** Бүх API-д тавих ерөнхий дээд хязгаар. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 300,
  message: 'Хэт олон хүсэлт илгээлээ. Түр хүлээнэ үү.',
});
