import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireRole, requireStaff } from '../middleware/auth.js';

export const staffRouter = Router();
const STAFF_ROLES = ['MANAGER', 'CASHIER', 'KITCHEN', 'DRIVER'] as const;
const select = { id: true, name: true, email: true, phone: true, role: true, isActive: true, isOnline: true, currentLat: true, currentLng: true, lastPingAt: true, createdAt: true } as const;

staffRouter.get('/', requireStaff, requireRole('DIRECTOR', 'MANAGER'), asyncHandler(async (req, res) => {
  const staff = await prisma.user.findMany({
    where: { tenantId: req.tenantId!, role: { not: 'USER' } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select,
  });
  res.json({ staff });
}));

/**
 * Утасны дугаар ЭСВЭЛ и-мэйл.
 *
 * Нэвтрэлт Verify.MN утсаар болсон тул ихэнх дансанд и-мэйл нь
 * `<утас>@phone.hool.mn` гэж автоматаар үүссэн байдаг — тэрийг эзэн нь ч
 * мэддэггүй. Тиймээс утсаар хайх боломжийг заавал өгнө.
 *
 * `email`-ийг хуучин нэрээр нь хүлээж авсаар байна: web (Vercel) болон api
 * (Render) тусдаа deploy болдог тул шинэ api хуучин web-тэй хэдэн минут
 * зэрэгцэн ажиллана. Тэр зайд ажилтан нэмэх нь унах ёсгүй.
 */
const createSchema = z
  .object({
    identifier: z.string().min(4).optional(),
    email: z.string().min(4).optional(),
    role: z.enum(STAFF_ROLES),
  })
  .transform((v, ctx) => {
    const identifier = (v.identifier ?? v.email ?? '').trim();
    if (identifier.length < 4) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Утасны дугаар эсвэл и-мэйл оруулна уу' });
      return z.NEVER;
    }
    return { identifier, role: v.role };
  });

/**
 * Оруулсан утгаас Prisma-гийн `where` бүтээнэ.
 *
 * Утас нь баазад ялгаатай хэлбэрээр хадгалагдсан байдаг: `/auth/phone/verify`
 * нь `+976`-г таслаад 8 оронтойг нь үлдээдэг бол `/auth/register` нь
 * хэрэглэгчийн бичсэнээр нь шууд хадгалдаг (`+97688746068` ч байж болно).
 * Тиймээс хоёр талыг нь сүүлийн 8 оронгоор жишнэ — Монголын дугаар яг тэр
 * 8 орон. Урдаас нь `976`-г таслах гэвэл `97612345` гэсэн ЖИНХЭНЭ дугаарыг
 * мохоох тул тэгэхгүй.
 *
 * Тохирох зүйлгүй бол `null`.
 */
export function accountLookup(identifier: string) {
  const raw = identifier.trim();

  // MySQL-ийн default collation и-мэйлийг том/жижиг үсэг ялгалгүй тулгана.
  if (raw.includes('@')) return { email: { equals: raw } };

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return { phone: { endsWith: digits.slice(-8) } };
}

/** Оруулсан утгыг и-мэйл эсвэл утас гэж үзээд данс хайна. */
async function findAccountBy(identifier: string) {
  const where = accountLookup(identifier);
  return where && prisma.account.findFirst({ where });
}

staffRouter.post('/', requireStaff, requireRole('DIRECTOR'), asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const account = await findAccountBy(body.identifier);
  if (!account) {
    throw badRequest('Ийм хэрэглэгч олдсонгүй. Тэр хүн эхлээд утсаараа нэг удаа нэвтэрсэн байх ёстой.');
  }
  const member = await prisma.user.upsert({
    where: { tenantId_accountId: { tenantId: req.tenantId!, accountId: account.id } },
    update: { role: body.role, isActive: true },
    create: {
      tenantId: req.tenantId!, accountId: account.id, name: account.name,
      email: account.email, phone: account.phone, role: body.role,
    },
    select,
  });
  res.status(201).json({ staff: member });
}));

const updateSchema = z.object({ role: z.enum(STAFF_ROLES).optional(), isActive: z.boolean().optional() });
staffRouter.patch('/:id', requireStaff, requireRole('DIRECTOR'), asyncHandler(async (req, res) => {
  const data = updateSchema.parse(req.body);
  const current = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } });
  if (!current) throw notFound('Ажилтан олдсонгүй');
  if (current.role === 'DIRECTOR') throw badRequest('Захирлын эрхийг эндээс өөрчлөх боломжгүй');
  const staff = await prisma.user.update({ where: { id: current.id }, data, select });
  res.json({ staff });
}));
