import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { errorHandler } from './lib/http.js';
import { apiLimiter } from './lib/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { tenantsRouter } from './routes/tenants.js';
import { menuRouter } from './routes/menu.js';
import { ordersRouter } from './routes/orders.js';
import { paymentsRouter } from './routes/payments.js';
import { requestsRouter } from './routes/restaurantRequests.js';
import { adminRouter } from './routes/admin.js';
import { tablesRouter } from './routes/tables.js';
import { reservationsRouter } from './routes/reservations.js';
import { staffRouter } from './routes/staff.js';
import { deliveriesRouter } from './routes/deliveries.js';
import { locationsRouter } from './routes/locations.js';
import { addressesRouter } from './routes/addresses.js';
import { reviewsRouter } from './routes/reviews.js';
import { startRealtime } from './realtime.js';
import { prisma } from './db.js';

const app = express();

// Reverse proxy-гийн ард ажиллах үед rate limit жинхэнэ IP-г харах ёстой.
if (env.isProd) app.set('trust proxy', 1);

app.use(helmet());

// Dev дээр л дурын localhost порт зөвшөөрнө. Regex-ийг эхнээс нь тогтоосон —
// өмнө нь "...localhost:3000"-оор төгссөн дурын домэйн тохирдог байв.
const allowedOrigins = env.isProd
  ? env.webOrigins
  : [...env.webOrigins, /^http:\/\/localhost:\d+$/];
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Stripe-ийн гарын үсэг ЗӨВХӨН түүхий биет дээр тооцогддог тул энэ зам
// express.json()-оос ӨМНӨ raw байдлаар уншигдана.
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/restaurant-requests', requestsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/addresses', addressesRouter);
app.use('/api/reviews', reviewsRouter);

app.use((_req, res) => res.status(404).json({ message: 'Ийм хаяг байхгүй' }));
app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`\n  Masteurent API  →  http://localhost:${env.port}/api`);
  console.log(`             Web  →  ${env.webOrigins.join(', ')}`);
  console.log('');
});
startRealtime(server);

// Байршлын түүхийг 7 хоногоос удаан хадгалахгүй (privacy retention).
const locationRetention = setInterval(() => {
  void prisma.locationPing.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 864e5) } } });
}, 864e5);
locationRetention.unref();

/**
 * Порт эзэлсэн байх нь хамгийн түгээмэл асуудал — 10 мөрийн stack trace
 * биш, юу хийхийг нь шууд хэлнэ.
 */
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Порт ${env.port}-г өөр процесс аль хэдийн эзэлсэн байна.`);
    console.error('    Ихэвчлэн өмнөх "npm run dev" бүрэн зогсоогүй үлдсэн байдаг.\n');
    console.error(`    Хэн эзэлснийг олох:   netstat -ano | findstr :${env.port}`);
    console.error('    Зогсоох:              taskkill /F /PID <дугаар> /T');
    console.error('    Эсвэл шууд:           npm run dev:clean\n');
    process.exit(1);
  }
  console.error('[api] Серверийн алдаа:', err);
  process.exit(1);
});

/**
 * Барьцгүй алдаа процессыг чимээгүй унагахаас сэргийлнэ.
 * Promise-ийн алдаа Node 15-аас хойш анхдагчаар процессыг унагадаг —
 * үүнийг барьж бүртгэвэл сервер ажилласаар үлдэнэ.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[api] Барьцгүй promise алдаа:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[api] Барьцгүй алдаа:', err);
});

// Ctrl+C / kill дээр холболтоо цэвэрхэн хаана — порт шууд чөлөөлөгдөнө.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Удаан холболт байвал хүлээлгүй хаана.
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
