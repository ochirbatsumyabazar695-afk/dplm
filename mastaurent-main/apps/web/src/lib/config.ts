/**
 * API хаана байгаа вэ.
 *
 * Dev дээр vite өөрөө `/api`-г 127.0.0.1:4000 руу дамжуулдаг тул харьцангуй
 * зам хангалттай. Production дээр web (Vercel) болон api (Render) нь ӨӨР
 * домэйн дээр суудаг — тэнд `/api` нь Vercel рүү очоод 404 болно. Тиймээс
 * `VITE_API_URL`-ээр API-гийн бүтэн хаягийг заана.
 *
 *   VITE_API_URL=https://masteurent-api.onrender.com
 *
 * Төгсгөлийн ташуу зураасыг авч хаяна — давхар `//` үүсэхээс сэргийлнэ.
 */
const rawApiUrl = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

/** `api()` энэ угтварын ард замаа залгана. */
export const API_BASE = rawApiUrl ? `${rawApiUrl}/api` : '/api';

/**
 * Socket.IO-гийн хаяг. Хоосон утга = хуудсыг үйлчилж буй эх хаяг руу
 * холбогдоно (dev дээр vite proxy ws-ийг дамжуулна).
 */
export const SOCKET_URL = rawApiUrl || undefined;
