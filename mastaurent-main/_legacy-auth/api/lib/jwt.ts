import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env } from '../env.js';

export type TokenPayload = {
  sub: string; // userId
  tenantId: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
  tv: number; // tokenVersion — logout хийхэд DB дээрх утга зөрж, токен хүчингүй болно
};

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';
export const REFRESH_COOKIE = 'hool_rt';

export const signAccess = (p: TokenPayload) =>
  jwt.sign(p, env.accessSecret, { expiresIn: ACCESS_TTL });

export const signRefresh = (p: TokenPayload) =>
  jwt.sign(p, env.refreshSecret, { expiresIn: REFRESH_TTL });

export const verifyAccess = (token: string) => jwt.verify(token, env.accessSecret) as TokenPayload;
export const verifyRefresh = (token: string) => jwt.verify(token, env.refreshSecret) as TokenPayload;

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.isProd || env.cookieSameSite === 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}
