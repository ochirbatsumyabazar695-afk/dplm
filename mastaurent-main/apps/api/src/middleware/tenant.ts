import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { badRequest, notFound } from '../lib/http.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

/**
 * Tenant-ыг таних: subdomain (prod) эсвэл ?tenant= / X-Tenant header (dev).
 * Энэ middleware-ийн дараах бүх query заавал tenantId-аар шүүгдэнэ —
 * нэг ресторан нөгөөгийнхөө өгөгдлийг харах боломжгүй.
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  const slug =
    (req.query.tenant as string | undefined) ??
    (req.headers['x-tenant'] as string | undefined) ??
    subdomainOf(req.hostname);

  if (!slug) return next(badRequest('Ресторан заагаагүй байна'));

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, isActive: true } });
  if (!tenant) return next(notFound('Ийм ресторан олдсонгүй'));
  if (!tenant.isActive) return next(notFound('Энэ ресторан идэвхгүй байна'));

  req.tenantId = tenant.id;
  next();
}

function subdomainOf(hostname: string): string | null {
  // IP хаягт subdomain байхгүй. Өмнө нь '127.0.0.1' нь '127' нэртэй
  // ресторан гэж уншигдаж, ойлгомжгүй 404 өгдөг байв.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return null;

  const parts = hostname.split('.');
  // Жинхэнэ subdomain: sub.domain.tld, эсвэл dev дээр sub.localhost.
  const isDevHost = parts.length === 2 && parts[1] === 'localhost';
  if (parts.length < 3 && !isDevHost) return null;

  const first = parts[0];
  if (['www', 'api'].includes(first)) return null;
  return first;
}

// Ажилтны tenant-ыг тогтоох үүрэг `requireStaff` руу шилжсэн —
// эх сурвалж нь DB дэх гишүүнчлэл (middleware/auth.ts).
