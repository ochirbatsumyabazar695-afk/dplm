import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, forbidden, unauthorized } from '../lib/http.js';
import { verifyAccess, type TokenPayload } from '../lib/jwt.js';

export type Role = 'DIRECTOR' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'DRIVER' | 'USER';

/** Платформын данс — нэвтэрсэн хүн өөрөө. Ресторанаас хамааралгүй. */
export type Account = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  isBlocked?: boolean;
};

/**
 * Тухайн ресторан дээрх гишүүнчлэл. Эрх, tenant-ыг ЗӨВХӨН DB-ээс уншина —
 * токены claim-д хэзээ ч найдахгүй.
 */
export type Member = {
  userId: string;
  accountId: string;
  tenantId: string;
  role: Role;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: Account;
      member?: Member;
    }
  }
}

const STAFF_ROLES: Role[] = ['DIRECTOR', 'MANAGER', 'CASHIER', 'KITCHEN', 'DRIVER'];
const accountSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  isPlatformAdmin: true,
  isBlocked: true,
};

// --- Дансыг таних (хоёр эх сурвалж) -----------------------------------------

function localPayload(req: Request): TokenPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyAccess(header.slice(7));
  } catch {
    return null;
  }
}

/** Токеноос дансыг олно. Нэвтрэлтийн ганц зам. */
async function resolveAccount(req: Request): Promise<Account | null> {
  const payload = localPayload(req);
  if (!payload) return null;

  const account = await prisma.account.findUnique({
    where: { id: payload.sub },
    select: { ...accountSelect, tokenVersion: true },
  });
  // Гарсан бол tokenVersion зөрнө → токен хүчингүй.
  if (!account || account.tokenVersion !== payload.tv) return null;

  const { tokenVersion, ...safe } = account;
  return safe.isBlocked ? null : safe;
}


// --- Гишүүнчлэл --------------------------------------------------------------

/**
 * Тухайн ресторан дээрх гишүүнчлэлийг олно, байхгүй бол үүсгэнэ.
 * Хэрэглэгч ресторанд анх хандахад профайл нь автоматаар бүрддэг.
 */
async function ensureMembership(account: Account, tenantId: string): Promise<Member> {
  const user = await prisma.user.upsert({
    where: { tenantId_accountId: { tenantId, accountId: account.id } },
    update: {},
    create: {
      tenantId,
      accountId: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      role: 'USER',
    },
    select: { id: true, tenantId: true, role: true },
  });

  return { userId: user.id, accountId: account.id, tenantId: user.tenantId, role: user.role };
}

// --- Middleware --------------------------------------------------------------

/** Зөвхөн нэвтэрсэн байхыг шаардана (ресторан хамаарахгүй). */
export const requireAccount = asyncHandler(async (req, _res, next) => {
  const account = await resolveAccount(req);
  if (!account) throw unauthorized();
  req.account = account;
  next();
});

/**
 * Платформын админ. Рестораны эрхээс тусдаа — рестораны эзэн байх нь
 * платформын админ болгодоггүй.
 */
export const requirePlatformAdmin = asyncHandler(async (req, _res, next) => {
  const account = await resolveAccount(req);
  if (!account) throw unauthorized();
  if (!account.isPlatformAdmin) throw forbidden('Платформын админ эрх шаардлагатай');
  req.account = account;
  next();
});

/** Storefront: `resolveTenant`-ийн ДАРАА. Гишүүнчлэл байхгүй бол үүснэ. */
export const requireMember = asyncHandler(async (req, _res, next) => {
  if (!req.tenantId) throw badRequest('Ресторан заагаагүй байна');
  const account = await resolveAccount(req);
  if (!account) throw unauthorized();

  req.account = account;
  req.member = await ensureMembership(account, req.tenantId);
  next();
});

/** Зочны захиалгад: нэвтэрсэн бол гишүүнчлэлийг тавина, үгүй бол өнгөрүүлнэ. */
export const optionalMember = asyncHandler(async (req, _res, next) => {
  if (!req.tenantId) return next();
  const account = await resolveAccount(req);
  if (account) {
    req.account = account;
    req.member = await ensureMembership(account, req.tenantId);
  }
  next();
});

/**
 * Ажилтны хэсэг. Ресторан нь гишүүнчлэлээс тодорхойлогдоно —
 * клиентээс ирсэн slug/header-т ХЭЗЭЭ Ч итгэхгүй.
 */
export const requireStaff = asyncHandler(async (req, _res, next) => {
  const account = await resolveAccount(req);
  if (!account) throw unauthorized();

  const staff = await prisma.user.findFirst({
    where: { accountId: account.id, role: { in: STAFF_ROLES }, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, tenantId: true, role: true },
  });
  if (!staff) throw forbidden('Танд рестораны удирдлагын эрх алга');

  req.account = account;
  req.member = {
    userId: staff.id,
    accountId: account.id,
    tenantId: staff.tenantId,
    role: staff.role,
  };
  req.tenantId = staff.tenantId;
  next();
});

/** Заасан эрхүүдийн аль нэгийг шаардана. requireStaff/requireMember-ийн ДАРАА. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.member) return next(unauthorized());
    if (!roles.includes(req.member.role)) return next(forbidden());
    next();
  };
}
