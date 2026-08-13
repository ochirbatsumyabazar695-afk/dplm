import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireMember } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
export const reviewsRouter = Router();
reviewsRouter.get('/', resolveTenant, asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({ where: { tenantId: req.tenantId! }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } } });
  res.json({ reviews });
}));
reviewsRouter.post('/', resolveTenant, requireMember, asyncHandler(async (req, res) => {
  const body = z.object({ orderId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }).parse(req.body);
  const order = await prisma.order.findFirst({ where: { id: body.orderId, tenantId: req.tenantId!, userId: req.member!.userId, status: 'COMPLETED' }, select: { id: true } });
  if (!order) throw notFound('Үнэлэх боломжтой захиалга олдсонгүй');
  if (await prisma.review.findUnique({ where: { orderId: order.id } })) throw badRequest('Энэ захиалгыг аль хэдийн үнэлсэн байна');
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({ data: { tenantId: req.tenantId!, orderId: order.id, userId: req.member!.userId, rating: body.rating, comment: body.comment } });
    const avg = await tx.review.aggregate({ where: { tenantId: req.tenantId! }, _avg: { rating: true } });
    await tx.tenant.update({ where: { id: req.tenantId! }, data: { rating: avg._avg.rating ?? 0 } });
    return created;
  });
  res.status(201).json({ review });
}));
