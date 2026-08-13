import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { requireAccount, requireRole, requireStaff } from '../middleware/auth.js';

export const tenantsRouter = Router();

const tenantDetail = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  description: true,
  logoUrl: true,
  coverUrl: true,
  accentColor: true,
  phone: true,
  address: true,
  latitude: true,
  longitude: true,
  deliveryRadiusKm: true,
  openHours: true,
  isTemporarilyClosed: true,
  openTime: true,
  closeTime: true,
  deliveryFee: true,
  minOrder: true,
  etaMinutes: true,
  rating: true,
  category: true,
  deliveryEnabled: true,
  pickupEnabled: true,
} as const;

/**
 * Ресторануудын жагсаалт — ЗӨВХӨН нэвтэрсэн хэрэглэгчид.
 * Нүүр хуудсанд жагсаалт гарахын өмнө бүртгүүлэх/нэвтрэх шаардлагатай.
 */
tenantsRouter.get(
  '/',
  requireAccount,
  asyncHandler(async (_req, res) => {
    const latitude = Number(_req.query.latitude), longitude = Number(_req.query.longitude);
    const category = typeof _req.query.category === 'string' ? _req.query.category : undefined;
    const minRating = Number(_req.query.minRating ?? 0);
    const search = typeof _req.query.q === 'string' ? _req.query.q.trim() : '';
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true, isTemporarilyClosed: false,
        ...(category ? { category } : {}), ...(minRating ? { rating: { gte: minRating } } : {}),
        // Postgres дээр `contains` нь том/жижиг үсэг ялгадаг тул insensitive заана.
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { category: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        logoUrl: true,
        coverUrl: true,
        accentColor: true,
        deliveryFee: true,
        minOrder: true,
        etaMinutes: true,
        rating: true,
        category: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        latitude: true,
        longitude: true,
        deliveryRadiusKm: true,
        _count: { select: { menuItems: true } },
      },
    });
    const filtered = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? tenants.filter((t) => t.latitude == null || t.longitude == null || haversine(t.latitude, t.longitude, latitude, longitude) <= t.deliveryRadiusKm)
      : tenants;
    res.json({ tenants: filtered });
  }),
);

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (n: number) => n * Math.PI / 180, dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Ажилтны өөрийн ресторан. `/:slug`-аас ӨМНӨ байх ёстой —
 * эс бөгөөс "me" нь slug гэж уншигдана.
 */
tenantsRouter.get(
  '/me',
  requireStaff,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId! },
      select: tenantDetail,
    });
    if (!tenant) throw notFound('Ресторан олдсонгүй');
    res.json({ tenant });
  }),
);

/** Storefront-ийн толгой мэдээлэл. */
tenantsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: tenantDetail,
    });
    if (!tenant) throw notFound('Ийм ресторан олдсонгүй');
    res.json({ tenant });
  }),
);

const settingsSchema = z.object({
  name: z.string().min(2).optional(),
  tagline: z.string().max(160).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  logoUrl: z.string().url().nullable().optional().or(z.literal('')),
  coverUrl: z.string().url().nullable().optional().or(z.literal('')),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Өнгө #RRGGBB хэлбэртэй байна').optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  deliveryRadiusKm: z.number().min(0.5).max(100).optional(),
  openHours: z.record(z.string(), z.object({ open: z.string(), close: z.string(), closed: z.boolean().optional() })).optional(),
  isTemporarilyClosed: z.boolean().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  deliveryFee: z.number().int().min(0).optional(),
  minOrder: z.number().int().min(0).optional(),
  etaMinutes: z.number().int().min(5).max(180).optional(),
  category: z.string().max(60).nullable().optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
});

/** Рестораны тохиргоо — зөвхөн эзэн/менежер. */
tenantsRouter.patch(
  '/me/settings',
  requireStaff,
  requireRole('DIRECTOR'),
  asyncHandler(async (req, res) => {
    const data = settingsSchema.parse(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId! },
      data,
      select: tenantDetail, // orderSeq зэрэг дотоод талбар клиент рүү гарахгүй
    });
    res.json({ tenant });
  }),
);
