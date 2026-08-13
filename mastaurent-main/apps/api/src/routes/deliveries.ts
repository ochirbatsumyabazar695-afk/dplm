import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireRole, requireStaff } from '../middleware/auth.js';

export const deliveriesRouter = Router();
const select = {
  id: true, orderNo: true, customerName: true, customerPhone: true,
  district: true, addressLine: true, deliveryLat: true, deliveryLng: true, status: true, deliveryStatus: true, createdAt: true,
  tenant: { select: { name: true, address: true, phone: true } },
  driver: { select: { id: true, name: true, phone: true } },
} as const;

deliveriesRouter.get('/mine', requireStaff, requireRole('DRIVER'), asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { tenantId: req.tenantId!, driverId: req.member!.userId, type: 'DELIVERY' },
    orderBy: { createdAt: 'desc' }, take: 100, select,
  });
  res.json({ orders });
}));

deliveriesRouter.get('/available', requireStaff, requireRole('DRIVER'), asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    // Жолооч бүх идэвхтэй хүргэлтийн дарааллыг харна. Харин claim endpoint
    // зөвхөн READY_FOR_DELIVERY болсон захиалгыг авахыг зөвшөөрнө.
    where: {
      tenantId: req.tenantId!, driverId: null, type: 'DELIVERY',
      status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] },
    },
    orderBy: { createdAt: 'asc' }, take: 50, select,
  });
  res.json({ orders });
}));

deliveriesRouter.post('/:id/claim', requireStaff, requireRole('DRIVER'), asyncHandler(async (req, res) => {
  const result = await prisma.order.updateMany({
    where: { id: req.params.id, tenantId: req.tenantId!, type: 'DELIVERY', driverId: null, deliveryStatus: 'READY_FOR_DELIVERY' },
    data: { driverId: req.member!.userId },
  });
  if (!result.count) throw badRequest('Энэ хүргэлтийг авах боломжгүй байна');
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, select });
  res.json({ order });
}));

const assignSchema = z.object({ driverId: z.string() });
deliveriesRouter.post('/:id/assign', requireStaff, requireRole('DIRECTOR', 'MANAGER'), asyncHandler(async (req, res) => {
  const { driverId } = assignSchema.parse(req.body);
  const driver = await prisma.user.findFirst({ where: { id: driverId, tenantId: req.tenantId!, role: 'DRIVER', isActive: true } });
  if (!driver) throw badRequest('Жолооч олдсонгүй');
  const result = await prisma.order.updateMany({ where: { id: req.params.id, tenantId: req.tenantId!, type: 'DELIVERY' }, data: { driverId } });
  if (!result.count) throw notFound('Хүргэлтийн захиалга олдсонгүй');
  res.json({ ok: true });
}));

const transitions: Record<string, string[]> = {
  READY_FOR_DELIVERY: ['PICKED_UP'], PICKED_UP: ['ON_THE_WAY'], ON_THE_WAY: ['DELIVERED'],
};
const statusSchema = z.object({ status: z.enum(['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), code: z.string().regex(/^\d{6}$/).optional() });
deliveriesRouter.patch('/:id/status', requireStaff, requireRole('DRIVER'), asyncHandler(async (req, res) => {
  const { status, latitude, longitude, code } = statusSchema.parse(req.body);
  const current = await prisma.order.findFirst({ where: { id: req.params.id, tenantId: req.tenantId!, driverId: req.member!.userId, type: 'DELIVERY' } });
  if (!current) throw notFound('Хүргэлт олдсонгүй');
  if (!current.deliveryStatus || !transitions[current.deliveryStatus]?.includes(status)) throw badRequest('Хүргэлтийн төлөвийн шилжилт буруу байна');
  if (status === 'DELIVERED' && (!current.deliveryCode || code !== current.deliveryCode)) {
    throw badRequest('Хүлээн авагчийн 6 оронтой код буруу байна');
  }
  const at = new Date();
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: current.id },
      data: { deliveryStatus: status, ...(status === 'PICKED_UP' ? { pickedUpAt: at } : {}), ...(status === 'DELIVERED' ? { status: 'COMPLETED', deliveredAt: at } : status === 'ON_THE_WAY' ? { status: 'DELIVERING' } : {}) },
      select,
    });
    await tx.locationPing.create({ data: { tenantId: req.tenantId!, driverId: req.member!.userId, orderId: current.id, latitude, longitude, createdAt: at } });
    return updated;
  });
  res.json({ order });
}));
