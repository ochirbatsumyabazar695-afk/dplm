import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { mnt } from '../../lib/format';
import type { MenuItemDetail, ModifierOption } from '../../lib/types';
import { useCart } from '../../store/cart';
import { Badge, Button, Page, Skeleton, SmartImage } from '../../components/ui';
import { Stepper } from '../../components/CartSheet';
import { cn } from '../../lib/cn';

export function ItemDetail() {
  const { slug = '', id = '' } = useParams();
  const navigate = useNavigate();
  const add = useCart((s) => s.add);

  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['item', slug, id],
    queryFn: () => api<{ item: MenuItemDetail }>(`/menu/items/${id}`),
  });

  const item = data?.item;

  const selected: ModifierOption[] = useMemo(() => {
    if (!item) return [];
    return item.modifierGroups.flatMap((g) =>
      g.options.filter((o) => (picked[g.id] ?? []).includes(o.id)),
    );
  }, [item, picked]);

  const missing = item?.modifierGroups.filter((g) => g.required && !picked[g.id]?.length) ?? [];
  const unitPrice = (item?.price ?? 0) + selected.reduce((s, o) => s + o.priceDelta, 0);

  function toggle(groupId: string, optionId: string, maxSelect: number) {
    setPicked((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect === 1) return { ...prev, [groupId]: [optionId] };
      const next = current.includes(optionId)
        ? current.filter((x) => x !== optionId)
        : current.length >= maxSelect
          ? current
          : [...current, optionId];
      return { ...prev, [groupId]: next };
    });
  }

  function handleAdd() {
    if (!item) return;
    if (missing.length) {
      toast.error(`"${missing[0].name}" сонголтыг хийнэ үү`);
      return;
    }
    add(
      slug,
      {
        menuItemId: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        basePrice: item.price,
        options: selected,
      },
      quantity,
    );
    toast.success(`${item.name} сагсанд нэмэгдлээ`);
    navigate(-1);
  }

  if (isLoading || !item) {
    return (
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="mt-5 h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-full" />
      </div>
    );
  }

  const tags = item.tags.split(',').filter(Boolean);

  return (
    <Page className="mx-auto max-w-2xl pb-8">
      <div className="relative h-72 sm:mt-6 sm:rounded-[18px] sm:overflow-hidden">
        <SmartImage src={item.imageUrl} alt={item.name} className="size-full" />
        <button
          onClick={() => navigate(-1)}
          aria-label="Буцах"
          className="absolute top-5 left-5 grid size-9 place-items-center rounded-full bg-white/90 backdrop-blur transition-transform hover:scale-105"
        >
          <ArrowLeft size={17} />
        </button>
      </div>

      <div className="px-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">{item.name}</h1>
          <span className="mt-1 shrink-0 text-[20px] font-semibold tabular-nums">
            {mnt(item.price)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.isPopular && (
            <Badge className="bg-warn/10 text-warn">
              <Flame size={12} /> Эрэлттэй
            </Badge>
          )}
          <Badge>
            <Clock size={12} /> {item.prepMinutes} мин
          </Badge>
          {item.calories && <Badge>{item.calories} ккал</Badge>}
          {tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>

        {item.description && (
          <p className="mt-4 text-[15px] leading-relaxed text-muted">{item.description}</p>
        )}

        {/* Сонголтууд */}
        <div className="mt-8 space-y-7">
          {item.modifierGroups.map((group) => (
            <section key={group.id}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[16px] font-semibold">{group.name}</h2>
                <span className="text-[12.5px] text-faint">
                  {group.required ? 'Заавал' : `Дээд тал нь ${group.maxSelect}`}
                </span>
              </div>

              <div className="space-y-2">
                {group.options.map((option) => {
                  const active = (picked[group.id] ?? []).includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggle(group.id, option.id, group.maxSelect)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-[12px] border px-4 py-3 text-left transition-all duration-150',
                        active
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            'grid size-[18px] place-items-center border transition-colors',
                            group.maxSelect === 1 ? 'rounded-full' : 'rounded-[5px]',
                            active ? 'border-accent bg-accent' : 'border-line-strong',
                          )}
                        >
                          {active && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className={cn(
                                'bg-white',
                                group.maxSelect === 1 ? 'size-1.5 rounded-full' : 'size-2 rounded-[2px]',
                              )}
                            />
                          )}
                        </span>
                        <span className="text-[14.5px]">{option.name}</span>
                      </span>
                      {option.priceDelta > 0 && (
                        <span className="text-[13.5px] text-muted tabular-nums">
                          +{mnt(option.priceDelta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Нэмэх */}
        <div className="mt-8 flex items-center gap-3">
          <Stepper value={quantity} onChange={(v) => setQuantity(Math.max(1, v))} size="md" />
          <Button full size="lg" onClick={handleAdd} className="justify-between">
            <span>Сагсанд нэмэх</span>
            <span className="tabular-nums">{mnt(unitPrice * quantity)}</span>
          </Button>
        </div>
      </div>
    </Page>
  );
}
