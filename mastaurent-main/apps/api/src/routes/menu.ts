import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireRole, requireStaff } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';

export const menuRouter = Router();

const itemSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  isAvailable: true,
  isPopular: true,
  prepMinutes: true,
  calories: true,
  tags: true,
  categoryId: true,
} as const;

// --- Нийтэд нээлттэй: storefront-ийн цэс -------------------------------------

/** Ангилал + хоолыг нэг дуудлагаар. */
menuRouter.get(
  '/',
  resolveTenant,
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        menuItems: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          select: itemSelect,
        },
      },
    });
    res.json({ categories: categories.filter((c) => c.menuItems.length > 0) });
  }),
);

/** Нэг хоолны дэлгэрэнгүй — сонголтуудтай. */
menuRouter.get(
  '/items/:id',
  resolveTenant,
  asyncHandler(async (req, res) => {
    const item = await prisma.menuItem.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      select: {
        ...itemSelect,
        category: { select: { id: true, name: true } },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            required: true,
            maxSelect: true,
            options: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, name: true, priceDelta: true },
            },
          },
        },
      },
    });
    if (!item) throw notFound('Хоол олдсонгүй');
    res.json({ item });
  }),
);

// --- Ажилтны хэсэг: цэс удирдах ----------------------------------------------

const staff = [requireStaff, requireRole('DIRECTOR', 'MANAGER')] as const;

/** Dashboard-ийн бүрэн цэс — идэвхгүй хоолыг ч оруулна. */
menuRouter.get(
  '/manage',
  ...staff,
  asyncHandler(async (req, res) => {
    const [categories, items] = await Promise.all([
      prisma.category.findMany({
        where: { tenantId: req.tenantId! },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.menuItem.findMany({
        where: { tenantId: req.tenantId! },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
        select: itemSelect,
      }),
    ]);
    res.json({ categories, items });
  }),
);

const categorySchema = z.object({
  name: z.string().min(1, 'Ангиллын нэр оруулна уу').max(60),
  sortOrder: z.number().int().default(0),
});

menuRouter.post(
  '/categories',
  ...staff,
  asyncHandler(async (req, res) => {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data: { ...data, tenantId: req.tenantId! } });
    res.status(201).json({ category });
  }),
);

menuRouter.patch(
  '/categories/:id',
  ...staff,
  asyncHandler(async (req, res) => {
    const data = categorySchema.partial().parse(req.body);
    const { count } = await prisma.category.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data,
    });
    if (!count) throw notFound('Ангилал олдсонгүй');
    res.json({ ok: true });
  }),
);

menuRouter.delete(
  '/categories/:id',
  ...staff,
  asyncHandler(async (req, res) => {
    const { count } = await prisma.category.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
    });
    if (!count) throw notFound('Ангилал олдсонгүй');
    res.json({ ok: true });
  }),
);

const itemSchema = z.object({
  categoryId: z.string().min(1, 'Ангилал сонгоно уу'),
  name: z.string().min(1, 'Хоолны нэр оруулна уу').max(120),
  description: z.string().max(600).nullable().optional(),
  imageUrl: z.string().max(600).nullable().optional(),
  price: z.number().int().min(0, 'Үнэ 0-ээс их байна'),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  prepMinutes: z.number().int().min(1).max(180).default(15),
  calories: z.number().int().min(0).nullable().optional(),
  tags: z.string().max(200).default(''),
  sortOrder: z.number().int().default(0),
});

menuRouter.post(
  '/items',
  ...staff,
  asyncHandler(async (req, res) => {
    const data = itemSchema.parse(req.body);
    await assertCategory(data.categoryId, req.tenantId!);
    const item = await prisma.menuItem.create({
      data: { ...data, tenantId: req.tenantId! },
      select: itemSelect,
    });
    res.status(201).json({ item });
  }),
);

menuRouter.patch(
  '/items/:id',
  ...staff,
  asyncHandler(async (req, res) => {
    const data = itemSchema.partial().parse(req.body);
    if (data.categoryId) await assertCategory(data.categoryId, req.tenantId!);
    const { count } = await prisma.menuItem.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
      data,
    });
    if (!count) throw notFound('Хоол олдсонгүй');
    const item = await prisma.menuItem.findUnique({ where: { id: req.params.id }, select: itemSelect });
    res.json({ item });
  }),
);

menuRouter.delete(
  '/items/:id',
  ...staff,
  asyncHandler(async (req, res) => {
    const { count } = await prisma.menuItem.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId! },
    });
    if (!count) throw notFound('Хоол олдсонгүй');
    res.json({ ok: true });
  }),
);

async function assertCategory(categoryId: string, tenantId: string) {
  const found = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
  if (!found) throw notFound('Ангилал олдсонгүй');
}

const modifierSchema = z.object({
  name: z.string().min(1).max(60),
  required: z.boolean().default(false),
  maxSelect: z.number().int().min(1).max(20).default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(z.object({
    id: z.string().optional(), name: z.string().min(1).max(60),
    priceDelta: z.number().int(), sortOrder: z.number().int().default(0),
  })).max(50).default([]),
});

/** Modifier groups are replaced atomically so stale options cannot survive an edit. */
menuRouter.put('/items/:id/modifiers', ...staff, asyncHandler(async (req, res) => {
  const groups = z.array(modifierSchema).max(20).parse(req.body.groups);
  const item = await prisma.menuItem.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! }, select: { id: true } });
  if (!item) throw notFound('Хоол олдсонгүй');
  for (const group of groups) if (group.required && group.maxSelect < 1) throw badRequest('Заавал сонгох бүлэг буруу байна');
  await prisma.$transaction(async (tx) => {
    await tx.modifierGroup.deleteMany({ where: { menuItemId: item.id } });
    for (const group of groups) {
      await tx.modifierGroup.create({ data: {
        menuItemId: item.id, name: group.name, required: group.required,
        maxSelect: group.maxSelect, sortOrder: group.sortOrder,
        options: { create: group.options.map(({ id: _id, ...option }) => option) },
      } });
    }
  });
  res.json({ ok: true });
}));

menuRouter.patch('/category-order', ...staff, asyncHandler(async (req, res) => {
  const ids = z.array(z.string()).min(1).max(200).parse(req.body.ids);
  const owned = await prisma.category.count({ where: { tenantId: req.tenantId!, id: { in: ids } } });
  if (owned !== new Set(ids).size) throw badRequest('Ангиллын дараалал буруу байна');
  await prisma.$transaction(ids.map((id, sortOrder) => prisma.category.update({ where: { id }, data: { sortOrder } })));
  res.json({ ok: true });
}));
