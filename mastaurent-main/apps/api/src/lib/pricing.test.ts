import { describe, expect, it } from 'vitest';
import { HttpError } from './http.js';
import { assertTransition, priceOrder, type PriceableGroup } from './pricing.js';

const buuz = { id: 'item-buuz', name: 'Бууз', price: 8000, imageUrl: null };
const shol = { id: 'item-shol', name: 'Шөл', price: 5000, imageUrl: null };
const items = [buuz, shol];

const groups: PriceableGroup[] = [
  {
    id: 'g-size',
    menuItemId: 'item-buuz',
    name: 'Хэмжээ',
    required: true,
    maxSelect: 1,
    options: [
      { id: 'o-small', name: 'Жижиг', priceDelta: 0 },
      { id: 'o-big', name: 'Том', priceDelta: 2000 },
    ],
  },
  {
    id: 'g-extra',
    menuItemId: 'item-buuz',
    name: 'Нэмэлт',
    required: false,
    maxSelect: 2,
    options: [
      { id: 'o-cheese', name: 'Бяслаг', priceDelta: 1500 },
      { id: 'o-sauce', name: 'Соус', priceDelta: 500 },
      { id: 'o-egg', name: 'Өндөг', priceDelta: 1000 },
    ],
  },
  // Шөлний өөрийн бүлэг — буузных биш.
  {
    id: 'g-shol',
    menuItemId: 'item-shol',
    name: 'Талх',
    required: false,
    maxSelect: 1,
    options: [{ id: 'o-bread', name: 'Талх', priceDelta: 700 }],
  },
];

const expectBadRequest = (fn: () => unknown, match: RegExp) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(400);
    expect((e as HttpError).message).toMatch(match);
    return;
  }
  throw new Error('Алдаа шидэх ёстой байсан');
};

describe('priceOrder', () => {
  it('үнийг серверийн өгөгдлөөс тооцоолно', () => {
    const { lines, subtotal } = priceOrder(
      [{ menuItemId: 'item-buuz', quantity: 3, optionIds: ['o-big', 'o-cheese'] }],
      items,
      groups,
    );

    // 8000 + 2000 + 1500 = 11500, × 3 = 34500
    expect(lines[0].unitPrice).toBe(11500);
    expect(lines[0].lineTotal).toBe(34500);
    expect(lines[0].options).toBe('Том, Бяслаг');
    expect(subtotal).toBe(34500);
  });

  it('өөр хоолны сонголтыг татгалзана', () => {
    // Шөл дээр буузны "Том" сонголтыг наах оролдлого.
    expectBadRequest(
      () => priceOrder([{ menuItemId: 'item-shol', quantity: 1, optionIds: ['o-big'] }], items, groups),
      /байхгүй сонголт/,
    );
  });

  it('огт байхгүй сонголтыг татгалзана', () => {
    expectBadRequest(
      () => priceOrder([{ menuItemId: 'item-buuz', quantity: 1, optionIds: ['o-hack'] }], items, groups),
      /байхгүй сонголт/,
    );
  });

  it('maxSelect-ээс хэтэрсэн сонголтыг татгалзана', () => {
    expectBadRequest(
      () =>
        priceOrder(
          [{ menuItemId: 'item-buuz', quantity: 1, optionIds: ['o-small', 'o-big'] }],
          items,
          groups,
        ),
      /хамгийн ихдээ 1/,
    );
  });

  it('заавал сонгох бүлэг хоосон бол татгалзана', () => {
    expectBadRequest(
      () => priceOrder([{ menuItemId: 'item-buuz', quantity: 1, optionIds: [] }], items, groups),
      /Хэмжээ/,
    );
  });

  it('давхардсан сонголтыг нэг удаа бодно', () => {
    const { lines } = priceOrder(
      [{ menuItemId: 'item-buuz', quantity: 1, optionIds: ['o-big', 'o-big', 'o-big'] }],
      items,
      groups,
    );
    expect(lines[0].unitPrice).toBe(10000); // 8000 + 2000, гурав дахин биш
  });

  it('байхгүй/дууссан хоолыг татгалзана', () => {
    expectBadRequest(
      () => priceOrder([{ menuItemId: 'item-ustsan', quantity: 1, optionIds: [] }], items, groups),
      /байхгүй эсвэл дууссан/,
    );
  });

  it('бүлэггүй хоолыг сонголтгүйгээр зөвшөөрнө', () => {
    const { subtotal } = priceOrder(
      [{ menuItemId: 'item-shol', quantity: 2, optionIds: [] }],
      items,
      groups,
    );
    expect(subtotal).toBe(10000);
  });
});

describe('assertTransition', () => {
  it('дараалсан шилжилтийг зөвшөөрнө', () => {
    expect(() => assertTransition('PENDING', 'CONFIRMED')).not.toThrow();
    expect(() => assertTransition('DELIVERING', 'COMPLETED')).not.toThrow();
  });

  it('ижил төлөв рүү шилжихийг зөвшөөрнө', () => {
    expect(() => assertTransition('PREPARING', 'PREPARING')).not.toThrow();
  });

  it('алгасах шилжилтийг татгалзана', () => {
    expectBadRequest(() => assertTransition('PENDING', 'COMPLETED'), /шилжих боломжгүй/);
  });

  it('дууссан захиалгыг буцаахыг татгалзана', () => {
    expectBadRequest(() => assertTransition('CANCELLED', 'PREPARING'), /шилжих боломжгүй/);
    expectBadRequest(() => assertTransition('COMPLETED', 'PENDING'), /шилжих боломжгүй/);
  });
});
