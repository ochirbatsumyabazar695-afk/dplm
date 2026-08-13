import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, unauthorized } from '../lib/http.js';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  setRefreshCookie,
  signAccess,
  signRefresh,
  verifyRefresh,
} from '../lib/jwt.js';
import { authLimiter } from '../lib/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';

export const authRouter = Router();

const publicUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
  tenantId: true,
} as const;

const registerSchema = z.object({
  name: z.string().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт'),
  email: z.string().email('И-мэйл буруу байна'),
  phone: z.string().min(8, 'Утасны дугаар 8 оронтой байна').max(12),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт'),
});

authRouter.post(
  '/register',
  authLimiter,
  resolveTenant,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const exists = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: body.email } },
    });
    if (exists) throw badRequest('Энэ и-мэйл бүртгэлтэй байна');

    const user = await prisma.user.create({
      data: {
        tenantId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: 'CUSTOMER',
      },
      select: { ...publicUser, tokenVersion: true },
    });

    const { tokenVersion, ...safe } = user;
    issue(res, user);
    res.status(201).json({ user: safe, accessToken: signAccess(payloadOf(user)) });
  }),
);

const loginSchema = z.object({
  email: z.string().email('И-мэйл буруу байна'),
  password: z.string().min(1, 'Нууц үгээ оруулна уу'),
});

authRouter.post(
  '/login',
  authLimiter,
  resolveTenant,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: req.tenantId!, email: body.email } },
    });
    if (!user) throw unauthorized('И-мэйл эсвэл нууц үг буруу');

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw unauthorized('И-мэйл эсвэл нууц үг буруу');

    const safe = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      tenantId: user.tenantId,
    };
    issue(res, user);
    res.json({ user: safe, accessToken: signAccess(payloadOf(user)) });
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

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { ...publicUser, tokenVersion: true },
    });
    if (!user) throw unauthorized('Хэрэглэгч олдсонгүй');

    // Гарсан бол tokenVersion зөрнө → хуучин токен ажиллахгүй.
    if (user.tokenVersion !== payload.tv) {
      clearRefreshCookie(res);
      throw unauthorized('Сесс хүчингүй болсон байна');
    }

    const { tokenVersion, ...safe } = user;
    res.json({ user: safe, accessToken: signAccess(payloadOf(user)) });
  }),
);

/** Гарах — DB дээрх tokenVersion-ыг ахиулж бүх хуучин токеныг хүчингүй болгоно. */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = verifyRefresh(token);
        await prisma.user.update({
          where: { id: payload.sub },
          data: { tokenVersion: { increment: 1 } },
        });
      } catch {
        // Токен хүчингүй/хэрэглэгч устсан — cookie цэвэрлэхэд л хангалттай.
      }
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub }, select: publicUser });
    if (!user) throw unauthorized();
    res.json({ user });
  }),
);

type SafeUser = {
  id: string;
  tenantId: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
  tokenVersion: number;
};
const payloadOf = (u: SafeUser) => ({
  sub: u.id,
  tenantId: u.tenantId,
  role: u.role,
  tv: u.tokenVersion,
});
const issue = (res: Parameters<typeof setRefreshCookie>[0], u: SafeUser) =>
  setRefreshCookie(res, signRefresh(payloadOf(u)));
