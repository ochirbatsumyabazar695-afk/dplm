import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { cartTotals, lineTotal, useCart, useCartLines } from '../store/cart';
import { mnt } from '../lib/format';
import { useTenant } from '../layouts/StorefrontLayout';
import { Button, EmptyState, Sheet, SmartImage } from './ui';

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { slug = '' } = useParams();
  const tenant = useTenant();
  const navigate = useNavigate();
  const lines = useCartLines(slug);
  const { setQuantity, remove } = useCart();
  const { subtotal, count } = cartTotals(lines);
  const dineIn = Boolean(sessionStorage.getItem(`hool_table_${slug}`));

  const belowMin = subtotal < tenant.minOrder;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={count ? `Сагс · ${count} зүйл` : 'Сагс'}
      footer={
        count ? (
          <div className="space-y-3">
            <div className="space-y-1.5 text-[14px]">
              <Row label="Дүн" value={mnt(subtotal)} />
              <Row label={dineIn ? 'Үйлчилгээ' : 'Хүргэлт'} value={dineIn ? 'Ширээн дээр' : mnt(tenant.deliveryFee)} muted />
              <div className="h-px bg-line" />
              <Row label="Нийт" value={mnt(subtotal + (dineIn ? 0 : tenant.deliveryFee))} strong />
            </div>

            {belowMin && (
              <p className="rounded-[10px] bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
                Хамгийн бага захиалга {mnt(tenant.minOrder)} — дахин{' '}
                {mnt(tenant.minOrder - subtotal)} нэмнэ үү.
              </p>
            )}

            <Button
              full
              size="lg"
              disabled={belowMin}
              onClick={() => {
                onClose();
                navigate(`/t/${slug}/checkout`);
              }}
            >
              Захиалга үргэлжлүүлэх
            </Button>
          </div>
        ) : undefined
      }
    >
      {count === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={30} strokeWidth={1.5} />}
          title="Сагс хоосон байна"
          description="Цэснээс дуртай хоолоо нэмээрэй."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                navigate(`/t/${slug}/menu`);
              }}
            >
              Цэс үзэх
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {lines.map((line) => (
              <motion.li
                key={line.key}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                className="flex gap-3 overflow-hidden py-3"
              >
                <SmartImage
                  src={line.imageUrl}
                  alt={line.name}
                  className="size-16 shrink-0 rounded-[10px]"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium">{line.name}</p>
                  {line.options.length > 0 && (
                    <p className="truncate text-[12.5px] text-muted">
                      {line.options.map((o) => o.name).join(', ')}
                    </p>
                  )}
                  <p className="mt-0.5 text-[13.5px] font-medium">{mnt(lineTotal(line))}</p>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={() => remove(slug, line.key)}
                    aria-label="Устгах"
                    className="text-faint transition-colors hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                  <Stepper
                    value={line.quantity}
                    onChange={(q) => setQuantity(slug, line.key, q)}
                  />
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Sheet>
  );
}

export function Stepper({
  value,
  onChange,
  size = 'sm',
}: {
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'size-7' : 'size-9';
  return (
    <div className="flex items-center gap-1 rounded-full border border-line p-0.5">
      <button
        onClick={() => onChange(value - 1)}
        aria-label="Хасах"
        className={`${dim} grid place-items-center rounded-full text-muted transition-colors hover:bg-black/[0.05] hover:text-ink`}
      >
        <Minus size={14} />
      </button>
      <span className="min-w-5 text-center text-[13.5px] font-medium tabular-nums">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        aria-label="Нэмэх"
        className={`${dim} grid place-items-center rounded-full text-muted transition-colors hover:bg-black/[0.05] hover:text-ink`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? 'pt-1 font-semibold' : ''}`}>
      <span className={muted || !strong ? 'text-muted' : ''}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
