import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireRole, requireStaff } from '../middleware/auth.js';
import { emitOrder, emitTenant } from '../realtime.js';

export const locationsRouter = Router();
const point = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), orderId: z.string().optional() });

locationsRouter.patch('/online', requireStaff, requireRole('DRIVER'), asyncHandler(async (req, res) => {
  const { isOnline } = z.object({ isOnline: z.boolean() }).parse(req.body);
  await prisma.user.update({ where: { id: req.member!.userId }, data: { isOnline, ...(!isOnline ? { currentLat: null, currentLng: null, lastPingAt: null } : {}) } });
  emitTenant(req.tenantId!, 'driver-presence', { driverId: req.member!.userId, isOnline });
  res.json({ isOnline });
}));

locationsRouter.post('/ping', requireStaff, requireRole('DRIVER'), asyncHandler(async (req, res) => {
  const data = point.parse(req.body);
  const driver = await prisma.user.findUnique({ where: { id: req.member!.userId }, select: { isOnline: true } });
  if (!driver?.isOnline) throw badRequest('Байршил дамжуулахын өмнө online болгоно уу');
  let orderId: string | null = null;
  if (data.orderId) {
    const order = await prisma.order.findFirst({ where: { id: data.orderId, tenantId: req.tenantId!, driverId: req.member!.userId, status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } }, select: { id: true } });
    if (!order) throw notFound('Идэвхтэй хүргэлт олдсонгүй');
    orderId = order.id;
  } else throw badRequest('Байршил зөвхөн идэвхтэй хүргэлтийн үед дамжина');
  const at = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.member!.userId }, data: { currentLat: data.latitude, currentLng: data.longitude, lastPingAt: at } }),
    prisma.locationPing.create({ data: { tenantId: req.tenantId!, driverId: req.member!.userId, orderId, latitude: data.latitude, longitude: data.longitude, createdAt: at } }),
  ]);
  const payload = { driverId: req.member!.userId, latitude: data.latitude, longitude: data.longitude, at };
  if (orderId) emitOrder(orderId, 'driver-location', payload);
  emitTenant(req.tenantId!, 'driver-location', payload);
  res.status(201).json({ ok: true, at });
}));

locationsRouter.get('/track/:token', asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { trackToken: req.params.token },
    select: { id: true, status: true, deliveryLat: true, deliveryLng: true, driver: { select: { isOnline: true, currentLat: true, currentLng: true, lastPingAt: true } }, tenant: { select: { latitude: true, longitude: true } } },
  });
  if (!order) throw notFound('Захиалга олдсонгүй');
  const active = !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status);
  res.json({ location: active && order.driver?.isOnline ? order.driver : null, restaurant: order.tenant, destination: { latitude: order.deliveryLat, longitude: order.deliveryLng } });
}));

locationsRouter.get('/manage', requireStaff, requireRole('DIRECTOR', 'MANAGER'), asyncHandler(async (req, res) => {
  const drivers = await prisma.user.findMany({ where: { tenantId: req.tenantId!, role: 'DRIVER', isActive: true }, select: { id: true, name: true, phone: true, isOnline: true, currentLat: true, currentLng: true, lastPingAt: true } });
  res.json({ drivers });
}));
