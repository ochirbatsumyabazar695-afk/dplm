import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderPlus, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import { mnt } from '../../lib/format';
import type { Category, MenuItem } from '../../lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, Page, Select, Sheet, Skeleton, SmartImage, Textarea } from '../../components/ui';
import { cn } from '../../lib/cn';

type ManageData = { categories: Omit<Category, 'menuItems'>[]; items: MenuItem[] };

const EMPTY = {
  id: '',
  categoryId: '',
  name: '',
  description: '',
  imageUrl: '',
  price: 0,
  prepMinutes: 15,
  calories: '' as number | '',
  tags: '',
  isAvailable: true,
  isPopular: false,
};

type Draft = typeof EMPTY;

export function DashboardMenu() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['manage-menu'],
    queryFn: () => api<ManageData>('/menu/manage'),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['manage-menu'] });
    void qc.invalidateQueries({ queryKey: ['menu'] });
  };

  const saveItem = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        categoryId: d.categoryId,
        name: d.name,
        description: d.description || null,
        imageUrl: d.imageUrl || null,
        price: Number(d.price),
        prepMinutes: Number(d.prepMinutes),
        calories: d.calories === '' ? null : Number(d.calories),
        tags: d.tags,
        isAvailable: d.isAvailable,
        isPopular: d.isPopular,
      };
      return d.id
        ? api(`/menu/items/${d.id}`, { method: 'PATCH', body })
        : api('/menu/items', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(draft?.id ? 'Хоол шинэчлэгдлээ' : 'Хоол нэмэгдлээ');
      setDraft(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Хадгалахад алдаа гарлаа'),
  });

  const toggleAvailable = useMutation({
    mutationFn: (item: MenuItem) =>
      api(`/menu/items/${item.id}`, { method: 'PATCH', body: { isAvailable: !item.isAvailable } }),
    onSuccess: refresh,
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api(`/menu/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Хоол устлаа');
      refresh();
    },
  });

  const addCategory = useMutation({
    mutationFn: () => api('/menu/categories', { method: 'POST', body: { name: catName } }),
    onSuccess: () => {
      toast.success('Ангилал нэмэгдлээ');
      setCatOpen(false);
      setCatName('');
      refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Алдаа гарлаа'),
  });

  const categories = data?.categories ?? [];

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Цэс</h1>
          <p className="mt-1 text-muted">{data?.items.length ?? 0} хоол · {categories.length} ангилал</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCatOpen(true)}>
            <FolderPlus size={15} /> Ангилал
          </Button>
          <Button
            size="sm"
            disabled={!categories.length}
            onClick={() => setDraft({ ...EMPTY, categoryId: categories[0]?.id ?? '' })}
          >
            <Plus size={15} /> Хоол нэмэх
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !categories.length ? (
        <EmptyState
          icon={<UtensilsCrossed size={30} strokeWidth={1.5} />}
          title="Цэс хоосон байна"
          description="Эхлээд ангилал үүсгэж, дараа нь хоол нэмнэ."
          action={<Button onClick={() => setCatOpen(true)}>Ангилал үүсгэх</Button>}
        />
      ) : (
        <div className="mt-8 space-y-8">
          {categories.map((cat, ci) => {
            const items = data!.items.filter((i) => i.categoryId === cat.id);
            return (
              <section key={cat.id}>
                <div className="rule mb-4 flex items-baseline gap-4 pt-4">
                  <span className="label numeral">{String(ci + 1).padStart(2, '0')}</span>
                  <h2 className="text-[19px] tracking-[-0.03em]">{cat.name}</h2>
                  <span className="label ml-auto">{items.length} хоол</span>
                </div>

                {items.length === 0 ? (
                  <p className="rounded-[12px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-faint">
                    Энэ ангилалд хоол алга
                  </p>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <AnimatePresence initial={false}>
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.22 }}
                        >
                          <Card
                            className={cn(
                              'flex items-center gap-3 p-3 transition-opacity',
                              !item.isAvailable && 'opacity-55',
                            )}
                          >
                            <SmartImage
                              src={item.imageUrl}
                              alt={item.name}
                              className="size-14 shrink-0 rounded-[10px]"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[14.5px] font-medium">{item.name}</p>
                                {item.isPopular && (
                                  <Badge className="bg-warn/10 text-warn">Эрэлттэй</Badge>
                                )}
                              </div>
                              <p className="truncate text-[12.5px] text-muted">{item.description}</p>
                              <p className="mt-0.5 text-[13.5px] font-medium tabular-nums">
                                {mnt(item.price)}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <Toggle
                                on={item.isAvailable}
                                onClick={() => toggleAvailable.mutate(item)}
                              />
                              <button
                                onClick={() =>
                                  setDraft({
                                    id: item.id,
                                    categoryId: item.categoryId,
                                    name: item.name,
                                    description: item.description ?? '',
                                    imageUrl: item.imageUrl ?? '',
                                    price: item.price,
                                    prepMinutes: item.prepMinutes,
                                    calories: item.calories ?? '',
                                    tags: item.tags,
                                    isAvailable: item.isAvailable,
                                    isPopular: item.isPopular,
                                  })
                                }
                                aria-label="Засах"
                                className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-black/[0.05] hover:text-ink"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`"${item.name}"-г устгах уу?`)) removeItem.mutate(item.id);
                                }}
                                aria-label="Устгах"
                                className="grid size-8 place-items-center rounded-full text-faint transition-colors hover:bg-bad/10 hover:text-bad"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Хоолны маягт */}
      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Хоол засах' : 'Шинэ хоол'}
        footer={
          <Button
            full
            size="lg"
            loading={saveItem.isPending}
            onClick={() => draft && saveItem.mutate(draft)}
          >
            Хадгалах
          </Button>
        }
      >
        {draft && (
          <div className="space-y-4 pb-2">
            <Field label="Нэр">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Бууз"
              />
            </Field>

            <Field label="Ангилал">
              <Select
                value={draft.categoryId}
                onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Тайлбар">
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Гар хийцийн үхрийн махан бууз..."
              />
            </Field>

            <Field label="Зургийн холбоос" hint="https:// эхэлсэн зургийн хаяг">
              <Input
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Үнэ ₮">
                <Input
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                />
              </Field>
              <Field label="Бэлтгэх мин">
                <Input
                  type="number"
                  value={draft.prepMinutes}
                  onChange={(e) => setDraft({ ...draft, prepMinutes: Number(e.target.value) })}
                />
              </Field>
              <Field label="Ккал">
                <Input
                  type="number"
                  value={draft.calories}
                  onChange={(e) =>
                    setDraft({ ...draft, calories: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </Field>
            </div>

            <Field label="Шошго" hint="Таслалаар тусгаарлана: шинэ, цагаан хоол">
              <Input
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                placeholder="шинэ, эрэлттэй"
              />
            </Field>

            <div className="flex gap-3">
              <Check
                label="Захиалах боломжтой"
                checked={draft.isAvailable}
                onChange={(v) => setDraft({ ...draft, isAvailable: v })}
              />
              <Check
                label="Эрэлттэй гэж тэмдэглэх"
                checked={draft.isPopular}
                onChange={(v) => setDraft({ ...draft, isPopular: v })}
              />
            </div>
          </div>
        )}
      </Sheet>

      {/* Ангиллын маягт */}
      <Sheet
        open={catOpen}
        onClose={() => setCatOpen(false)}
        title="Шинэ ангилал"
        footer={
          <Button full size="lg" loading={addCategory.isPending} onClick={() => addCategory.mutate()}>
            Нэмэх
          </Button>
        }
      >
        <div className="space-y-4 pb-2">
          <Field label="Нэр" hint="Цэсэн дэх ангиллын гарчиг болно">
            <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Шөл" />
          </Field>
        </div>
      </Sheet>
    </Page>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label="Захиалах боломжтой эсэх"
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
        on ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <motion.span
        animate={{ x: on ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-1 size-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex flex-1 items-center gap-2.5 rounded-[11px] border px-3.5 py-3 text-left text-[13.5px] transition-colors',
        checked ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-[5px] border',
          checked ? 'border-accent bg-accent' : 'border-line-strong',
        )}
      >
        {checked && <span className="size-2 rounded-[2px] bg-white" />}
      </span>
      {label}
    </button>
  );
}
