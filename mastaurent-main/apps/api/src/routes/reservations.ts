import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { orderLimiter } from '../lib/rateLimit.js';
import { optionalMember, requireMember, requireRole, requireStaff } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';

/**
 * Ширээ захиалга.
 *
 *   харилцагч илгээнэ (PENDING)
 *      → ресторан зөвшөөрнө (CONFIRMED) эсвэл татгалзана (REJECTED)
 *      → ирж суувал SEATED → дуусвал COMPLETED
 *
 * Бүх ажилтны query `tenantId`-аар шүүгдэнэ — өөр рестораны захиалга харагдахгүй.
 */
export const reservationsRouter = Router();

const reservationSelect = {
  id: true,
  customerName: true,
  customerPhone: true,
  partySize: true,
  reservedAt: true,
  reservedTime: true,
  note: true,
  status: true,
  reviewNote: true,
  createdAt: true,
  table: { select: { id: true, number: true, capacity: true } },
} as const;

const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

/** Зөвшөөрөгдөх төлвийн шилжилтүүд. Дууссан/цуцлагдсанаас буцахгүй. */
const TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'CANCELLED'],
  SEATED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

// --- Харилцагчийн тал ---------------------------------------------------------

const createSchema = z.object({
  customerName: z.string().min(2, 'Нэрээ оруулна уу').max(80),
  customerPhone: z.string().min(8, 'Утасны дугаараа оруулна уу').max(12),
  partySize: z.number().int().min(1, 'Хүний тоо 1-ээс их байна').max(50),
  // "2026-08-20" хэлбэрээр
  reservedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Огноо буруу байна'),
  reservedTime: z.string().regex(/^\d{2}:\d{2}$/, 'Цаг HH:MM хэлбэртэй байна'),
  tableId: z.string().optional(),
  note: z.string().max(300).optional(),
});

/** Ширээ захиалах. Нэвтрээгүй ч болно — зочин утсаараа баталгаажуулна. */
reservationsRouter.post(
  '/',
  orderLimiter,
  resolveTenant,
  optionalMember,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const reservedAt = new Date(`${body.reservedDate}T00:00:00`);
    if (Number.isNaN(reservedAt.getTime())) throw badRequest('Огноо буруу байна');

    // Өнгөрсөн өдөр рүү захиалахаас сэргийлнэ.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reservedAt < today) throw badRequest('Өнгөрсөн өдөр рүү захиалах боломжгүй');

    // Ширээ заасан бол ЭНЭ рестораных мөн эсэхийг шалгана.
    if (body.tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: body.tableId, tenantId },
        select: { id: true, capacity: true, status: true },
      });
      if (!table) throw badRequest('Ширээ олдсонгүй');
      if (table.status === 'OUT_OF_SERVICE') throw badRequest('Энэ ширээ ашиглалтад байхгүй');
      if (table.capacity < body.partySize) {
        throw badRequest(`Энэ ширээ хамгийн ихдээ ${table.capacity} хүний багтаамжтай`);
      }
    }

    const reservation = await prisma.reservation.create({
      data: {
        tenantId,
        tableId: body.tableId ?? null,
        userId: req.member?.userId ?? null,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        partySize: body.partySize,
        reservedAt,
        reservedTime: body.reservedTime,
        note: body.note,
      },
      select: reservationSelect,
    });
    res.status(201).json({ reservation });
  }),
);

/** Харилцагчийн өөрийн захиалгууд. */
reservationsRouter.get(
  '/mine',
  resolveTenant,
  requireMember,
  asyncHandler(async (req, res) => {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.member!.userId, tenantId: req.member!.tenantId },
      orderBy: { reservedAt: 'desc' },
      select: reservationSelect,
    });
    res.json({ reservations });
  }),
);

// --- Ажилтны хэсэг -----------------------------------------------------------

const listQuerySchema = z.object({
  status: z.enum([...RESERVATION_STATUSES, 'ALL']).optional(),
  // "2026-08-20" — тухайн өдрийн захиалгыг харах
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

reservationsRouter.get(
  '/manage',
  requireStaff,
  requireRole('DIRECTOR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { status, date } = listQuerySchema.parse(req.query);

    const dayFilter = date
      ? {
          reservedAt: {
            gte: new Date(`${date}T00:00:00`),
            lt: new Date(new Date(`${date}T00:00:00`).getTime() + 864e5),
          },
        }
      : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId: req.tenantId!,
        ...(status && status !== 'ALL' ? { status } : {}),
        ...dayFilter,
      },
      orderBy: [{ reservedAt: 'asc' }, { reservedTime: 'asc' }],
      take: 200,
      select: reservationSelect,
    });
    res.json({ reservations });
  }),
);

const statusSchema = z.object({
  status: z.enum(RESERVATION_STATUSES),
  reviewNote: z.string().max(300).optional(),
  /** Зөвшөөрөх үед ширээ хуваарилж болно. */
  tableId: z.string().nullable().optional(),
});

reservationsRouter.patch(
  '/:id/status',
  requireStaff,
  requireRole('DIRECTOR', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = statusSchema.parse(req.body);

    const current = await prisma.reservation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      select: { status: true },
    });
    if (!current) throw notFound('Захиалга олдсонгүй');

    if (current.status !== body.status && !TRANSITIONS[current.status]?.includes(body.status)) {
      throw badRequest(`"${current.status}" төлвөөс "${body.status}" рүү шилжих боломжгүй`);
    }

    if (body.tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: body.tableId, tenantId: req.tenantId! },
        select: { id: true },
      });
      if (!table) throw badRequest('Ширээ олдсонгүй');
    }

    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: {
        status: body.status,
        ...(body.reviewNote !== undefined ? { reviewNote: body.reviewNote } : {}),
        ...(body.tableId !== undefined ? { tableId: body.tableId } : {}),
      },
      select: reservationSelect,
    });
    res.json({ reservation });
  }),
);
