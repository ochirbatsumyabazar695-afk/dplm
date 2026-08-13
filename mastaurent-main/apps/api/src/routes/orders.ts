import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { assertTransition, priceOrder } from '../lib/pricing.js';
import { orderLimiter } from '../lib/rateLimit.js';
import { optionalMember, requireMember, requireRole, requireStaff } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { emitOrder, emitTenant } from '../realtime.js';

export const ordersRouter = Router();

const orderSelect = {
  id: true,
  orderNo: true,
  trackToken: true,
  type: true,
  customerName: true,
  customerPhone: true,
  district: true,
  addressLine: true,
  note: true,
  status: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  paymentMethod: true,
  isPaid: true,
  rejectReason: true,
  confirmedAt: true,
  preparingAt: true,
  readyAt: true,
  pickedUpAt: true,
  deliveredAt: true,
  deliveryStatus: true,
  deliveryCode: true,
  driver: { select: { id: true, name: true, phone: true } },
  table: { select: { id: true, number: true } },
  createdAt: true,
  items: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      unitPrice: true,
      quantity: true,
      options: true,
      lineTotal: true,
    },
  },
} as const;

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERING',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

const createSchema = z.object({
  type: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']).default('DELIVERY'),
  tableToken: z.string().min(10).optional(),
  customerName: z.string().min(2).max(80).optional(),
  customerPhone: z.string().regex(/^\d{8}$/, 'Утасны дугаар 8 оронтой тоо байна').optional(),
  // Хүргэлтийн үед л шаардлагатай — доор нэмэлт шалгалттай.
  district: z.string().max(60).optional(),
  addressLine: z.string().max(300).optional(),
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  note: z.string().max(300).optional(),
  // CASH — хүргэлтийн үед. QPAY/STRIPE/WIRE — онлайнаар, төлбөр тусад нь үүснэ.
  paymentMethod: z.enum(['CASH', 'QPAY', 'STRIPE', 'WIRE']).default('CASH'),

  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        optionIds: z.array(z.string()).max(20).default([]),
      }),
    )
    .min(1, 'Сагс хоосон байна')
    .max(50),
});

/**
 * Захиалга үүсгэх. Үнийг ЗӨВХӨН серверээс уншина —
 * клиентээс ирсэн дүнд хэзээ ч итгэхгүй.
 */
ordersRouter.post(
  '/',
  orderLimiter,
  resolveTenant,
  optionalMember,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const tenantId = req.tenantId!;
    const itemIds = [...new Set(body.items.map((i) => i.menuItemId))];

    const [tenant, menuItems, groups, table] = await Promise.all([
      prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          deliveryFee: true,
          minOrder: true,
          deliveryEnabled: true,
          pickupEnabled: true,
          isTemporarilyClosed: true,
          latitude: true,
          longitude: true,
          deliveryRadiusKm: true,
          openHours: true,
        },
      }),
      prisma.menuItem.findMany({
        where: { id: { in: itemIds }, tenantId, isAvailable: true },
        select: { id: true, name: true, price: true, imageUrl: true },
      }),
      // Сонголтуудыг хоол тус бүрийн бүлгээр нь татна — priceOrder
      // сонголт өөр хоолных эсэхийг үүгээр шалгана.
      prisma.modifierGroup.findMany({
        where: { menuItem: { id: { in: itemIds }, tenantId } },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          menuItemId: true,
          name: true,
          required: true,
          maxSelect: true,
          options: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true, priceDelta: true },
          },
        },
      }),
      body.type === 'DINE_IN' && body.tableToken
        ? prisma.restaurantTable.findFirst({
            where: { qrToken: body.tableToken, tenantId, status: { not: 'OUT_OF_SERVICE' } },
            select: { id: true, number: true },
          })
        : null,
    ]);

    /*
     * Хүлээн авах хэлбэрийн шалгалт — frontend товч нуухаас хамаарахгүй.
     * Хүргэлтгүй ресторанд API-аар шууд DELIVERY захиалга үүсгэх боломжгүй.
     */
    if (body.type === 'DELIVERY' && !tenant.deliveryEnabled) {
      throw badRequest('Энэ ресторан хүргэлтийн үйлчилгээ үзүүлдэггүй');
    }
    if (tenant.isTemporarilyClosed) throw badRequest('Ресторан түр хаалттай байна');
    if (!isOpenNow(tenant.openHours)) {
      throw badRequest('Ресторан одоо хаалттай байна');
    }
    if (body.type === 'PICKUP' && !tenant.pickupEnabled) {
      throw badRequest('Энэ ресторан очиж авах үйлчилгээ үзүүлдэггүй');
    }
    if (body.type === 'DINE_IN' && !table) throw badRequest('Ширээний QR код хүчингүй байна');
    if (body.type !== 'DINE_IN' && !body.customerPhone) throw badRequest('Утасны дугаараа оруулна уу');

    // Зочин хэрэглэгч утас + GPS цэгээр шууд захиална. Хуучин клиентүүдийн
    // дүүрэг + бичгэн хаягийг мөн хүлээн авсаар байна.
    if (body.type === 'DELIVERY') {
      const hasPoint = body.deliveryLat != null && body.deliveryLng != null;
      const hasWrittenAddress = Boolean(body.district?.trim() && (body.addressLine ?? '').trim().length >= 4);
      if (!hasPoint && !hasWrittenAddress) {
        throw badRequest('Хүргэх байршлаа илгээнэ үү');
      }
      // Газрын зураг дээр цэг тавих нь СОНГОЛТ. Дүүрэг + дэлгэрэнгүй хаяг
      // хүргэлтэд хангалттай; цэг заавал шаардвал захиалга өгөх урсгал
      // дэмий тасалдана.
      //
      // Цэг тавьсан бол л бүсийн шалгалтыг хийнэ — тавиагүй үед зайг
      // тооцох боломжгүй тул шалгах ч зүйлгүй.
      if (
        body.deliveryLat != null &&
        body.deliveryLng != null &&
        tenant.latitude != null &&
        tenant.longitude != null &&
        distanceKm(tenant.latitude, tenant.longitude, body.deliveryLat, body.deliveryLng) >
          tenant.deliveryRadiusKm
      ) {
        throw badRequest(`Хаяг хүргэлтийн ${tenant.deliveryRadiusKm} км бүсээс гадуур байна`);
      }
    }

    const { lines, subtotal } = priceOrder(body.items, menuItems, groups);

    if (subtotal < tenant.minOrder) {
      throw badRequest(`Хамгийн бага захиалга ${tenant.minOrder.toLocaleString('mn-MN')}₮`);
    }

    // Очиж авахад хүргэлтийн төлбөр байхгүй.
    const deliveryFee = body.type === 'DELIVERY' ? tenant.deliveryFee : 0;

    // Гишүүнчлэл нь угаасаа энэ ресторанд харьяалагдана (optionalMember нь
    // req.tenantId-аар л хайдаг) — өөр рестораных орох боломжгүй.
    const userId = req.member?.userId ?? null;

    const order = await prisma.$transaction(async (tx) => {
      const stillAvailable = await tx.menuItem.count({ where: { id: { in: itemIds }, tenantId, isAvailable: true } });
      if (stillAvailable !== itemIds.length) throw badRequest('Сагсанд дууссан хоол байна. Сагсаа шинэчилнэ үү');
      // Атом increment — DB мөрийг түгжинэ. Зэрэг ирсэн хоёр захиалга
      // ижил дугаар авахгүй.
      const { orderSeq } = await tx.tenant.update({
        where: { id: tenantId },
        data: { orderSeq: { increment: 1 } },
        select: { orderSeq: true },
      });

      return tx.order.create({
        data: {
          tenantId,
          orderNo: orderSeq,
          userId,
          tableId: table?.id ?? null,
          type: body.type,
          customerName: body.customerName?.trim() || (table ? table.number : `Зочин ${body.customerPhone!.slice(-4)}`),
          customerPhone: body.customerPhone ?? 'TABLE',
          // Очиж авах захиалгад хаяг хадгалахгүй.
          district: body.type === 'DELIVERY' ? body.district : null,
          addressLine: body.type === 'DELIVERY' ? body.addressLine : null,
          deliveryLat: body.type === 'DELIVERY' ? body.deliveryLat : null,
          deliveryLng: body.type === 'DELIVERY' ? body.deliveryLng : null,
          deliveryCode: body.type === 'DELIVERY' ? String(randomInt(100000, 1000000)) : null,
          note: body.note,
          paymentMethod: body.paymentMethod,
          subtotal,
          deliveryFee: body.type === 'DELIVERY' ? deliveryFee : 0,
          total: subtotal + (body.type === 'DELIVERY' ? deliveryFee : 0),
          items: { create: lines },
        },
        select: orderSelect,
      });
    }, { isolationLevel: 'Serializable' });

    res.status(201).json({ order });
    emitTenant(tenantId, 'new-order', { id: order.id, orderNo: order.orderNo });
  }),
);

ordersRouter.patch('/mine/:id/cancel', resolveTenant, requireMember, asyncHandler(async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, tenantId: req.tenantId!, userId: req.member!.userId }, select: { id: true, status: true } });
  if (!order) throw notFound('Захиалга олдсонгүй');
  if (order.status !== 'PENDING') throw badRequest('Баталсан захиалгыг хэрэглэгч цуцлах боломжгүй');
  await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  res.json({ ok: true });
}));

/** Харилцагчийн өөрийн захиалгууд. */
ordersRouter.get(
  '/mine',
  resolveTenant,
  requireMember,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.member!.userId, tenantId: req.member!.tenantId },
      orderBy: { createdAt: 'desc' },
      select: orderSelect,
    });
    res.json({ orders });
  }),
);

/**
 * Нууц түлхүүрээр хянах — нэвтрээгүй ч болно.
 * Түлхүүр нь cuid тул таамаглах боломжгүй. Өмнө нь дараалсан orderNo-оор
 * хандах боломжтой байсан нь бүх харилцагчийн хаяг, утсыг задалдаг байв.
 */
ordersRouter.get(
  '/track/:token',
  resolveTenant,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { trackToken: req.params.token, tenantId: req.tenantId! },
      select: orderSelect,
    });
    if (!order) throw notFound('Захиалга олдсонгүй');
    res.json({ order });
  }),
);

// --- Ажилтны хэсэг ------------------------------------------------------------

// requireStaff нь эрхийг шалгаад req.tenantId-г гишүүнчлэлээс тавина.
const staff = [requireStaff, requireRole('DIRECTOR', 'MANAGER', 'CASHIER')] as const;

/** Гал тогоонд хэрэглэгчийн хаяг, утас, үнэ/орлого өгөхгүй. */
ordersRouter.get(
  '/kitchen',
  requireStaff,
  requireRole('KITCHEN'),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { tenantId: req.tenantId!, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true, orderNo: true, type: true, note: true, status: true, createdAt: true,
        items: { select: { id: true, name: true, quantity: true, options: true } },
      },
    });
    res.json({ orders });
  }),
);

const kitchenStatusSchema = z.object({ status: z.enum(['CONFIRMED', 'PREPARING', 'READY']) });
ordersRouter.patch(
  '/:id/kitchen-status',
  requireStaff,
  requireRole('KITCHEN'),
  asyncHandler(async (req, res) => {
    const { status } = kitchenStatusSchema.parse(req.body);
    const current = await prisma.order.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! }, select: { status: true, type: true } });
    if (!current) throw notFound('Захиалга олдсонгүй');

    // DELIVERY-г ресторан/менежер DELIVERING эсвэл COMPLETED болгож болохгүй.
    // PREPARING → READY болсны дараа жолооч өөрийн delivery урсгалаар явна.
    if (current.type === 'DELIVERY' && ['DELIVERING', 'COMPLETED'].includes(status)) {
      throw badRequest('Хүргэлтийн төлөвийг зөвхөн жолооч шинэчилнэ');
    }
    assertTransition(current.status, status, current.type);
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status, ...(status === 'READY' && current.type === 'DELIVERY' ? { deliveryStatus: 'READY_FOR_DELIVERY' } : {}) },
      select: { id: true, orderNo: true, status: true, deliveryStatus: true },
    });
    res.json({ order });
  }),
);

const listQuerySchema = z.object({
  status: z.enum([...ORDER_STATUSES, 'ALL']).optional(),
});

ordersRouter.get(
  '/manage',
  ...staff,
  asyncHandler(async (req, res) => {
    // Zod-оор шүүнэ — өмнө нь дурын мөр Prisma руу орж 500 өгдөг байсан.
    const { status } = listQuerySchema.parse(req.query);
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.tenantId!,
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: orderSelect,
    });
    res.json({ orders });
  }),
);

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES), rejectReason: z.string().min(3).max(300).optional() });

ordersRouter.patch(
  '/:id/status',
  ...staff,
  asyncHandler(async (req, res) => {
    const { status, rejectReason } = statusSchema.parse(req.body);

    const current = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      select: { status: true, paymentMethod: true, type: true },
    });
    if (!current) throw notFound('Захиалга олдсонгүй');

    if (current.type === 'DELIVERY' && ['DELIVERING', 'COMPLETED'].includes(status)) {
      throw badRequest('Хүргэлтийн төлөвийг зөвхөн жолооч шинэчилнэ');
    }

    if (status === 'REJECTED') {
      if (current.status !== 'PENDING') throw badRequest('Зөвхөн шинэ захиалгыг татгалзана');
      if (!rejectReason) throw badRequest('Татгалзсан шалтгаан шаардлагатай');
    } else assertTransition(current.status, status, current.type);

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'REJECTED' ? { rejectReason } : {}),
        ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        ...(status === 'PREPARING' ? { preparingAt: new Date() } : {}),
        ...(status === 'READY' ? { readyAt: new Date(), ...(current.type === 'DELIVERY' ? { deliveryStatus: 'READY_FOR_DELIVERY' as const } : {}) } : {}),
        ...(status === 'COMPLETED' ? { deliveredAt: new Date() } : {}),
        // Бэлэн мөнгө хүргэлтийн үед төлөгдөнө. Карт нь Stripe орж иртэл
        // автоматаар төлөгдсөн болох ёсгүй.
        ...(status === 'COMPLETED' && current.paymentMethod === 'CASH' ? { isPaid: true } : {}),
      },
      select: orderSelect,
    });
    emitOrder(order.id, 'order-status', { status: order.status });
    res.json({ order });
  }),
);

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isOpenNow(value: unknown, now = new Date()) {
  if (!value || typeof value !== 'object') return true;
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const row = (value as Record<string, { open?: string; close?: string; closed?: boolean }>)[keys[now.getDay()]];
  if (!row) return true;
  if (row.closed) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const parse = (text?: string) => { const [h, m] = (text ?? '').split(':').map(Number); return Number.isFinite(h + m) ? h * 60 + m : null; };
  const open = parse(row.open), close = parse(row.close);
  if (open == null || close == null) return true;
  return close >= open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}

/** Dashboard-ийн товч статистик. */
ordersRouter.get(
  '/stats',
  ...staff,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [today, active, totals, topItems, reservations, tables] = await Promise.all([
      prisma.order.aggregate({
        where: { tenantId, createdAt: { gte: startOfDay }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.count({
        where: { tenantId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERING'] } },
      }),
      prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: { tenantId, status: { not: 'CANCELLED' } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.reservation.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      prisma.restaurantTable.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    const countBy = (rows: { status: string; _count: number }[]) =>
      Object.fromEntries(rows.map((r) => [r.status, r._count]));

    res.json({
      todayRevenue: today._sum.total ?? 0,
      todayOrders: today._count,
      activeOrders: active,
      totalRevenue: totals._sum.total ?? 0,
      completedOrders: totals._count,
      avgOrder: totals._count ? Math.round((totals._sum.total ?? 0) / totals._count) : 0,
      topItems: topItems.map((t) => ({ name: t.name, quantity: t._sum.quantity ?? 0 })),
      // Ширээ захиалгын товч статистик — самбарт харуулна.
      reservations: {
        total: reservations.reduce((s, r) => s + r._count, 0),
        byStatus: countBy(reservations),
        pending: countBy(reservations).PENDING ?? 0,
      },
      tables: {
        total: tables.reduce((s, t) => s + t._count, 0),
        byStatus: countBy(tables),
      },
    });
  }),
);

ordersRouter.get('/reports', ...staff, asyncHandler(async (req, res) => {
  const days = z.coerce.number().int().min(1).max(366).default(30).parse(req.query.days);
  const from = new Date(Date.now() - days * 864e5), tenantId = req.tenantId!;
  const [orders, drivers] = await Promise.all([
    prisma.order.findMany({ where: { tenantId, createdAt: { gte: from } }, select: { status: true, total: true, createdAt: true, confirmedAt: true, deliveredAt: true, driverId: true } }),
    prisma.user.findMany({ where: { tenantId, role: 'DRIVER' }, select: { id: true, name: true } }),
  ]);
  const completed = orders.filter((o) => o.status === 'COMPLETED');
  const rejected = orders.filter((o) => o.status === 'REJECTED');
  const deliveryMs = completed.filter((o) => o.confirmedAt && o.deliveredAt).map((o) => o.deliveredAt!.getTime() - o.confirmedAt!.getTime());
  const byDay = new Map<string, { orders: number; revenue: number }>();
  for (const order of orders) { const key = order.createdAt.toISOString().slice(0, 10), row = byDay.get(key) ?? { orders: 0, revenue: 0 }; row.orders++; if (order.status === 'COMPLETED') row.revenue += order.total; byDay.set(key, row); }
  res.json({ periodDays: days, orderCount: orders.length, revenue: completed.reduce((s, o) => s + o.total, 0), rejectionRate: orders.length ? rejected.length / orders.length : 0,
    averageDeliveryMinutes: deliveryMs.length ? Math.round(deliveryMs.reduce((a, b) => a + b, 0) / deliveryMs.length / 60000) : 0,
    daily: [...byDay].map(([date, value]) => ({ date, ...value })),
    drivers: drivers.map((driver) => { const rows = completed.filter((o) => o.driverId === driver.id); return { id: driver.id, name: driver.name, deliveries: rows.length, averageMinutes: Math.round(rows.filter((o) => o.confirmedAt && o.deliveredAt).reduce((s, o) => s + (o.deliveredAt!.getTime() - o.confirmedAt!.getTime()), 0) / Math.max(1, rows.length) / 60000) }; }),
  });
}));
