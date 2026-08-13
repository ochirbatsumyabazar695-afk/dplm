import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModifierOption } from '../lib/types';

export type CartLine = {
  key: string; // menuItemId + сонголтууд — ижил тохиргоо нэгддэг
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  options: ModifierOption[];
  quantity: number;
};

type CartState = {
  /** Ресторан бүр өөрийн сагстай — өөр дэлгүүр рүү орвол сагс холилдохгүй. */
  carts: Record<string, CartLine[]>;
  add: (slug: string, line: Omit<CartLine, 'key' | 'quantity'>, quantity?: number) => void;
  setQuantity: (slug: string, key: string, quantity: number) => void;
  remove: (slug: string, key: string) => void;
  clear: (slug: string) => void;
};

const keyOf = (menuItemId: string, options: ModifierOption[]) =>
  [menuItemId, ...options.map((o) => o.id).sort()].join('|');

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      carts: {},

      add: (slug, line, quantity = 1) =>
        set((s) => {
          const key = keyOf(line.menuItemId, line.options);
          const current = s.carts[slug] ?? [];
          const found = current.find((l) => l.key === key);
          const next = found
            ? current.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
            : [...current, { ...line, key, quantity }];
          return { carts: { ...s.carts, [slug]: next } };
        }),

      setQuantity: (slug, key, quantity) =>
        set((s) => ({
          carts: {
            ...s.carts,
            [slug]: (s.carts[slug] ?? [])
              .map((l) => (l.key === key ? { ...l, quantity } : l))
              .filter((l) => l.quantity > 0),
          },
        })),

      remove: (slug, key) =>
        set((s) => ({
          carts: { ...s.carts, [slug]: (s.carts[slug] ?? []).filter((l) => l.key !== key) },
        })),

      clear: (slug) => set((s) => ({ carts: { ...s.carts, [slug]: [] } })),
    }),
    { name: 'hool_cart' },
  ),
);

export const lineTotal = (l: CartLine) =>
  (l.basePrice + l.options.reduce((s, o) => s + o.priceDelta, 0)) * l.quantity;

export const cartTotals = (lines: CartLine[]) => ({
  count: lines.reduce((s, l) => s + l.quantity, 0),
  subtotal: lines.reduce((s, l) => s + lineTotal(l), 0),
});

/**
 * Компонентод хэрэглэхэд тохиромжтой selector.
 * EMPTY-г тогтмол байлгах нь чухал — render бүрт шинэ [] буцаавал
 * zustand-ын getSnapshot тэнцвэрээ алдаж дуусашгүй давталтад ордог.
 */
const EMPTY: CartLine[] = [];

export const useCartLines = (slug: string | undefined) =>
  useCart((s) => (slug ? (s.carts[slug] ?? EMPTY) : EMPTY));
