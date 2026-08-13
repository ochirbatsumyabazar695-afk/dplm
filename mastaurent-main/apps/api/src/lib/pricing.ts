import { badRequest } from './http.js';

/** Клиентээс ирэх нэг мөр. */
export type LineInput = {
  menuItemId: string;
  quantity: number;
  optionIds: string[];
};

export type PriceableItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

/** Тухайн хоолны сонголтын бүлэг — өөр хоолных ХЭЗЭЭ Ч биш. */
export type PriceableGroup = {
  id: string;
  menuItemId: string;
  name: string;
  required: boolean;
  maxSelect: number;
  options: { id: string; name: string; priceDelta: number }[];
};

export type PricedLine = {
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  options: string;
  lineTotal: number;
};

/**
 * Захиалгын үнийг серверийн өгөгдлөөс тооцоолж, сонголтуудыг шалгана.
 *
 * Гол зарчим: сонголт бүр ЯГ тухайн хоолны бүлэгт харьяалагдана.
 * Өмнө нь tenant дотор байгаа дурын сонголтыг наах боломжтой байсан —
 * шөл дээр пиццаны нэмэлт наачихаж болдог байв.
 */
export function priceOrder(
  input: LineInput[],
  items: PriceableItem[],
  groups: PriceableGroup[],
): { lines: PricedLine[]; subtotal: number } {
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Хоол бүрийн бүлгүүд, бүлэг бүрийн сонголтууд.
  const groupsByItem = new Map<string, PriceableGroup[]>();
  for (const g of groups) {
    const list = groupsByItem.get(g.menuItemId) ?? [];
    list.push(g);
    groupsByItem.set(g.menuItemId, list);
  }

  const lines = input.map((line) => {
    const item = itemById.get(line.menuItemId);
    if (!item) throw badRequest('Захиалгад байхгүй эсвэл дууссан хоол байна');

    const itemGroups = groupsByItem.get(item.id) ?? [];

    // Сонголтыг зөвхөн ЭНЭ хоолны бүлгүүдээс хайна.
    const optionOwner = new Map<string, PriceableGroup>();
    for (const g of itemGroups) for (const o of g.options) optionOwner.set(o.id, g);

    const uniqueIds = [...new Set(line.optionIds)];
    const chosenPerGroup = new Map<string, number>();
    const picked: { id: string; name: string; priceDelta: number }[] = [];

    for (const optionId of uniqueIds) {
      const group = optionOwner.get(optionId);
      if (!group) throw badRequest(`"${item.name}" дээр байхгүй сонголт байна`);

      const count = (chosenPerGroup.get(group.id) ?? 0) + 1;
      if (count > group.maxSelect) {
        throw badRequest(`"${group.name}" бүлгээс хамгийн ихдээ ${group.maxSelect} сонголт`);
      }
      chosenPerGroup.set(group.id, count);

      picked.push(group.options.find((o) => o.id === optionId)!);
    }

    // Заавал сонгох бүлгүүд бөглөгдсөн эсэх.
    for (const g of itemGroups) {
      if (g.required && !chosenPerGroup.get(g.id)) {
        throw badRequest(`"${item.name}" — "${g.name}" сонголтыг хийнэ үү`);
      }
    }

    const unitPrice = item.price + picked.reduce((s, o) => s + o.priceDelta, 0);
    if (unitPrice < 0) throw badRequest('Үнэ буруу тооцоологдлоо');

    return {
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      unitPrice,
      quantity: line.quantity,
      // Бүлгийн дарааллаар — харагдац тогтвортой байхын тулд.
      options: itemGroups
        .flatMap((g) => g.options.filter((o) => picked.some((p) => p.id === o.id)))
        .map((o) => o.name)
        .join(', '),
      lineTotal: unitPrice * line.quantity,
    };
  });

  return { lines, subtotal: lines.reduce((s, l) => s + l.lineTotal, 0) };
}

/**
 * Зөвшөөрөгдөх төлвийн шилжилтүүд. Буцаж CANCELLED-ээс гарахгүй.
 *
 * Хүлээн авах хэлбэрээс хамаарна:
 *   DELIVERY: … PREPARING → READY → (driver) DELIVERING → COMPLETED
 *   PICKUP:   … PREPARING → READY      → COMPLETED
 */
const DELIVERY_FLOW: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'DELIVERING', 'CANCELLED'],
  DELIVERING: ['COMPLETED', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

const PICKUP_FLOW: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  DELIVERING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function assertTransition(from: string, to: string, type: 'DELIVERY' | 'PICKUP' | 'DINE_IN' = 'DELIVERY') {
  if (from === to) return;
  const flow = type === 'DELIVERY' ? DELIVERY_FLOW : PICKUP_FLOW;
  if (!flow[from]?.includes(to)) {
    throw badRequest(`"${from}" төлвөөс "${to}" рүү шилжих боломжгүй`);
  }
}
