import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/http.js';
import { verifyAccess, type TokenPayload } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

function read(req: Request): TokenPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyAccess(header.slice(7));
  } catch {
    return null;
  }
}

/** Токен байвал req.auth-д тавина, байхгүй бол саадгүй өнгөрүүлнэ. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const payload = read(req);
  if (payload) req.auth = payload;
  next();
}

/** Нэвтэрсэн байхыг шаардана. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const payload = read(req);
  if (!payload) return next(unauthorized());
  req.auth = payload;
  next();
}

/** Заасан эрхүүдийн аль нэгийг шаардана. Rest дараалалд requireAuth-ийн дараа. */
export function requireRole(...roles: TokenPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
}

/** Ресторан удирдах эрх. */
export const requireStaff = requireRole('OWNER', 'MANAGER', 'STAFF');
