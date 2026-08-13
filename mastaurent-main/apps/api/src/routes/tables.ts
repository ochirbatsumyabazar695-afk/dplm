import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireRole, requireStaff } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';

/**
 * Ширээний удирдлага.
 *
 * Бүх query `where: { tenantId }`-тэй бөгөөд tenantId нь `requireStaff`-аас
 * буюу DB дэх гишүүнчлэлээс ирнэ — клиент өөрчилж чадахгүй.
 */
export const tablesRouter = Router();

const tableSelect = {
  id: true,
  number: true,
  capacity: true,
  status: true,
  note: true,
  qrToken: true,
} as const;

const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const;

/** Storefront: ширээ захиалахад сул ширээнүүдийг харуулна. */
tablesRouter.get(
  '/public',
  resolveTenant,
  asyncHandler(async (req, res) => {
    const tables = await prisma.restaurantTable.findMany({
      where: { tenantId: req.tenantId!, status: { not: 'OUT_OF_SERVICE' } },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, capacity: true, status: true, qrToken: true },
    });
    res.json({ tables });
  }),
);

/** QR token-оор ширээг танина. Token нь tenant-тай давхар тулгагдана. */
tablesRouter.get(
  '/qr/:token',
  resolveTenant,
  asyncHandler(async (req, res) => {
    const table = await prisma.restaurantTable.findFirst({
      where: { qrToken: req.params.token, tenantId: req.tenantId!, status: { not: 'OUT_OF_SERVICE' } },
      select: { id: true, number: true, capacity: true },
    });
    if (!table) throw notFound('QR код хүчингүй эсвэл ширээ ашиглалтгүй байна');
    res.json({ table });
  }),
);

// --- Ажилтны хэсэг -----------------------------------------------------------

tablesRouter.get(
  '/',
  requireStaff,
  requireRole('DIRECTOR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const tables = await prisma.restaurantTable.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { number: 'asc' },
      select: tableSelect,
    });
    res.json({ tables });
  }),
);

const tableSchema = z.object({
  number: z.string().min(1, 'Ширээний дугаар оруулна уу').max(20),
  capacity: z.number().int().min(1, 'Багтаамж 1-ээс их байна').max(50),
  status: z.enum(TABLE_STATUSES).default('AVAILABLE'),
  note: z.string().max(300).nullable().optional(),
});

tablesRouter.post(
  '/',
  requireStaff,
  requireRole('DIRECTOR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = tableSchema.parse(req.body);

    const exists = await prisma.restaurantTable.findUnique({
      where: { tenantId_number: { tenantId: req.tenantId!, number: data.number } },
      select: { id: true },
    });
    if (exists) throw badRequest('Энэ дугаартай ширээ аль хэдийн байна');

    const table = await prisma.restaurantTable.create({
      data: { ...data, tenantId: req.tenantId! },
      select: tableSelect,
    });
    res.status(201).json({ table });
  }),
);

tablesRouter.patch(
  '/:id',
  requireStaff,
  requireRole('DIRECTOR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = tableSchema.partial().parse(req.body);

    // Дугаар солих бол давхардлыг шалгана.
    if (data.number) {
      const clash = await prisma.restaurantTable.findFirst({
        where: { tenantId: req.tenantId!, number: data.number, id: { not: req.params.id } },
        select: { id: true },
      });
      if (clash) throw badRequest('Энэ дугаартай ширээ аль хэдийн байна');
    }

    const { count } = await prisma.restaurantTable.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data,
    });
    if (!count) throw notFound('Ширээ олдсонгүй');

    const table = await prisma.restaurantTable.findUnique({
      where: { id: req.params.id },
      select: tableSelect,
    });
    res.json({ table });
  }),
);

tablesRouter.delete(
  '/:id',
  requireStaff,
  requireRole('DIRECTOR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { count } = await prisma.restaurantTable.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
    });
    if (!count) throw notFound('Ширээ олдсонгүй');
    res.json({ ok: true });
  }),
);
