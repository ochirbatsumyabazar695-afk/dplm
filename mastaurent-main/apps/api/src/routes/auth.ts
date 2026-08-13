import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound, unauthorized } from '../lib/http.js';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  setRefreshCookie,
  signAccess,
  signRefresh,
  verifyRefresh,
} from '../lib/jwt.js';
import { authLimiter } from '../lib/rateLimit.js';
import { requireAccount, requireMember, requireStaff } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';

import { createVerifySession, checkSessionStatus } from '../lib/verifyMn.js';

/**
 * Платформын нэвтрэлт — ресторанаас хамааралгүй.
 */
export const authRouter = Router();

const publicAccount = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isPlatformAdmin: true,
} as const;

authRouter.get('/methods', (_req, res) => res.json({ password: true, verifyMn: true }));

const phoneStartSchema = z.object({
  phone: z.string().min(8, 'Утасны дугаар багадаа 8 оронтой байна').max(12),
});

const phoneVerifySchema = z.object({
  phone: z.string().min(8).max(12),
  sessionId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().min(2).optional(),
});

/** Verify.MN MO SMS сесс эхлүүлэх */
authRouter.post(
  '/phone/start',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = phoneStartSchema.parse(req.body);
    const session = await createVerifySession(phone);
    res.json({
      ok: true,
      sessionId: session.sessionId,
      shortcode: session.shortcode,
      text: session.text,
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt,
    });

  }),
);

/** Verify.MN MO SMS сесс баталгаажилт шалгаж нэвтрэх */
authRouter.post(
  '/phone/verify',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone, sessionId, code, name } = phoneVerifySchema.parse(req.body);

    const { verified } = await checkSessionStatus(sessionId || '', code);
    if (!verified) {
      throw badRequest('144773 дугаар руу SMS код илгээгдээгүй эсвэл код буруу байна');
    }

    const cleanPhone = phone.trim().replace(/^\+976/, '');
    const isAdminPhone = cleanPhone === '95238963';

    let account = await prisma.account.findFirst({
      where: { phone: cleanPhone },
    });

    if (!account) {
      const generatedEmail = `${cleanPhone}@phone.hool.mn`;
      account = await prisma.account.create({
        data: {
          name: isAdminPhone ? 'Platform Admin (95238963)' : (name ?? `Хэрэглэгч ${cleanPhone.slice(-4)}`),
          email: generatedEmail,
          phone: cleanPhone,
          isPlatformAdmin: isAdminPhone,
        },
      });
    } else if (isAdminPhone && !account.isPlatformAdmin) {
      account = await prisma.account.update({
        where: { id: account.id },
        data: { isPlatformAdmin: true },
      });
    }


    const safe = {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      isPlatformAdmin: account.isPlatformAdmin,
    };

    issue(res, account);
    res.json({ user: safe, accessToken: signAccess(payloadOf(account)) });
  }),
);


/** Verify.MN сесс төлөв шалгах (Polling endpoint - min 3s) */
authRouter.get(
  '/phone/status/:sessionId',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const status = await checkSessionStatus(sessionId);
    res.json(status);
  }),
);

/** Verify.MN 144773 SMS Webhook event callback (GET request wake-up signal) */
authRouter.all(
  '/verify-mn/callback',
  asyncHandler(async (req, res) => {
    const sessionId = (req.query.sessionId || req.query.session_id || req.body?.sessionId) as string | undefined;
    console.log('[Verify.MN Webhook Event]', { method: req.method, query: req.query, body: req.body });
    if (sessionId) {
      void checkSessionStatus(sessionId);
    }
    res.status(200).json({ ok: true });
  }),
);



type SafeAccount = { id: string; tokenVersion: number };
const payloadOf = (a: SafeAccount) => ({ sub: a.id, tv: a.tokenVersion });
const issue = (res: Parameters<typeof setRefreshCookie>[0], a: SafeAccount) =>
  setRefreshCookie(res, signRefresh(payloadOf(a)));

const registerSchema = z.object({
  name: z.string().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт'),
  email: z.string().email('И-мэйл буруу байна'),
  phone: z.string().min(8, 'Утасны дугаар 8 оронтой байна').max(12),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт'),
});

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const exists = await prisma.account.findUnique({ where: { email: body.email } });
    if (exists) throw badRequest('Энэ и-мэйл бүртгэлтэй байна');

    const account = await prisma.account.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash: await bcrypt.hash(body.password, 10),
      },
      select: { ...publicAccount, tokenVersion: true },
    });

    const { tokenVersion, ...safe } = account;
    issue(res, account);
    res.status(201).json({ user: safe, accessToken: signAccess(payloadOf(account)) });
  }),
);

const loginSchema = z.object({
  email: z.string().email('И-мэйл буруу байна'),
  password: z.string().min(1, 'Нууц үгээ оруулна уу'),
});

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const account = await prisma.account.findUnique({ where: { email: body.email } });
    if (!account) throw unauthorized('И-мэйл эсвэл нууц үг буруу');

    // Verify.MN утсаар үүссэн дансанд нууц үг байхгүй.
    if (!account.passwordHash) {
      throw unauthorized('Энэ бүртгэл нууц үггүй. Утасны дугаараараа нэвтэрнэ үү.');
    }
    if (!(await bcrypt.compare(body.password, account.passwordHash))) {
      throw unauthorized('И-мэйл эсвэл нууц үг буруу');
    }

    const safe = {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      isPlatformAdmin: account.isPlatformAdmin,
    };
    issue(res, account);
    res.json({ user: safe, accessToken: signAccess(payloadOf(account)) });
  }),
);

const resetPasswordSchema = z.object({
  phone: z.string().min(8, 'Утасны дугаар багадаа 8 оронтой байна').max(12),
  sessionId: z.string().min(1, 'Баталгаажуулах session дутуу байна'),
  code: z.string().optional(),
  password: z.string().min(6, 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт'),
});

/** Verify.MN-ээр утсаа баталгаажуулсны дараа нууц үгээ шинээр тохируулна. */
authRouter.post(
  '/password/reset',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const cleanPhone = body.phone.trim().replace(/^\+976/, '');
    const status = await checkSessionStatus(body.sessionId, body.code);
    if (!status.verified) throw badRequest('Утасны баталгаажуулалт амжилтгүй байна');

    // Provider утсыг буцаасан бол клиентээс ирсэн утгад итгэхгүй, заавал тулгана.
    if (status.phone) {
      const verifiedPhone = status.phone.trim().replace(/^\+976/, '');
      if (verifiedPhone !== cleanPhone) throw badRequest('Баталгаажуулсан утас таарахгүй байна');
    }

    const account = await prisma.account.findFirst({ where: { phone: { endsWith: cleanPhone.slice(-8) } } });
    if (!account) throw notFound('Энэ утсаар бүртгэл олдсонгүй');

    await prisma.account.update({
      where: { id: account.id },
      data: {
        passwordHash: await bcrypt.hash(body.password, 10),
        // Өмнөх access/refresh token-уудыг хүчингүй болгоно.
        tokenVersion: { increment: 1 },
      },
    });
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

/** Refresh cookie-гоор шинэ access token авна. */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw unauthorized('Сесс дууссан байна');

    let payload;
    try {
      payload = verifyRefresh(token);
    } catch {
      throw unauthorized('Сесс хүчингүй байна');
    }

    const account = await prisma.account.findUnique({
      where: { id: payload.sub },
      select: { ...publicAccount, tokenVersion: true },
    });
    if (!account) throw unauthorized('Хэрэглэгч олдсонгүй');

    if (account.tokenVersion !== payload.tv) {
      clearRefreshCookie(res);
      throw unauthorized('Сесс хүчингүй болсон байна');
    }

    const { tokenVersion, ...safe } = account;
    res.json({ user: safe, accessToken: signAccess(payloadOf(account)) });
  }),
);

/** Гарах — tokenVersion ахиулж бүх хуучин токеныг хүчингүй болгоно. */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = verifyRefresh(token);
        await prisma.account.update({
          where: { id: payload.sub },
          data: { tokenVersion: { increment: 1 } },
        });
      } catch {
        // Токен хүчингүй/данс устсан — cookie цэвэрлэхэд л хангалттай.
      }
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

/** Платформын данс. Ресторан заахгүй — нэвтэрсэн эсэхийг мэдэхэд хангалттай. */
authRouter.get('/me', requireAccount, (req, res) => res.json({ user: req.account }));

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(8).max(20).nullable().optional(),
});
authRouter.patch('/me', requireAccount, asyncHandler(async (req, res) => {
  const data = profileSchema.parse(req.body);
  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.account.update({ where: { id: req.account!.id }, data, select: publicAccount });
    await tx.user.updateMany({ where: { accountId: req.account!.id }, data: { ...(data.name ? { name: data.name } : {}), ...(data.phone !== undefined ? { phone: data.phone } : {}) } });
    return account;
  });
  res.json({ user });
}));

/** Тухайн рестораны профайл. Байхгүй бол энд үүснэ. */
authRouter.get(
  '/membership',
  resolveTenant,
  requireMember,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.member!.userId },
      select: { id: true, name: true, email: true, phone: true, role: true, tenantId: true },
    });
    if (!user) throw notFound('Профайл олдсонгүй');
    res.json({ user });
  }),
);

/** Dashboard: ажилтны гишүүнчлэл. Эрхгүй бол 403. */
authRouter.get(
  '/staff',
  requireStaff,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.member!.userId },
      select: { id: true, name: true, email: true, phone: true, role: true, tenantId: true },
    });
    if (!user) throw notFound('Хэрэглэгч олдсонгүй');
    res.json({ user });
  }),
);
