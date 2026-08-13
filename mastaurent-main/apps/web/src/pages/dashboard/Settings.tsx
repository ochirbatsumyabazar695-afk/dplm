import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import type { Tenant } from '../../lib/types';
import {
  Button,
  Card,
  Field,
  Input,
  Page,
  Skeleton,
  SmartImage,
  Textarea,
} from '../../components/ui';
import { cn } from '../../lib/cn';

const PRESET_COLORS = ['#0A0A0A', '#C1440E', '#D6336C', '#EA580C', '#16A34A', '#2563EB', '#7C3AED'];

export function DashboardSettings() {
  const tenant = useOutletContext<Tenant | null>();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Tenant> | null>(null);

  useEffect(() => {
    if (tenant && !form) setForm(tenant);
  }, [tenant, form]);

  const save = useMutation({
    mutationFn: (values: Partial<Tenant>) =>
      api<{ tenant: Tenant }>('/tenants/me/settings', {
        method: 'PATCH',
        body: {
          name: values.name,
          tagline: values.tagline || null,
          description: values.description || null,
          logoUrl: values.logoUrl || null,
          coverUrl: values.coverUrl || null,
          accentColor: values.accentColor,
          phone: values.phone || null,
          address: values.address || null,
          openTime: values.openTime,
          closeTime: values.closeTime,
          deliveryFee: Number(values.deliveryFee),
          minOrder: Number(values.minOrder),
          etaMinutes: Number(values.etaMinutes),
          deliveryEnabled: values.deliveryEnabled,
          pickupEnabled: values.pickupEnabled,
          latitude: values.latitude == null ? null : Number(values.latitude),
          longitude: values.longitude == null ? null : Number(values.longitude),
          deliveryRadiusKm: Number(values.deliveryRadiusKm ?? 5),
          isTemporarilyClosed: values.isTemporarilyClosed,
        },
      }),
    onSuccess: ({ tenant: updated }) => {
      toast.success('Тохиргоо хадгалагдлаа');
      document.documentElement.style.setProperty('--accent', updated.accentColor);
      document.documentElement.style.setProperty('--accent-soft', `${updated.accentColor}1f`);
      void qc.invalidateQueries({ queryKey: ['dash-tenant'] });
      void qc.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Хадгалахад алдаа гарлаа'),
  });

  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const set = <K extends keyof Tenant>(key: K, value: Tenant[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Page className="max-w-2xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Тохиргоо</h1>
          <p className="mt-1 text-muted">Рестораны нүүр хуудсанд шууд тусна.</p>
        </div>
        <Link
          to={`/t/${form.slug}`}
          target="_blank"
          className="flex items-center gap-1.5 text-[13.5px] font-medium text-muted transition-colors hover:text-ink"
        >
          Дэлгүүр үзэх <ExternalLink size={14} />
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="mt-7 space-y-6"
      >
        <Card className="space-y-4 p-6">
          <h2 className="text-[16px] font-semibold">Үндсэн мэдээлэл</h2>

          <Field label="Рестораны нэр">
            <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Богино тайлбар">
            <Input
              value={form.tagline ?? ''}
              onChange={(e) => set('tagline', e.target.value)}
              placeholder="Гэрийн амттай монгол хоол"
            />
          </Field>
          <Field label="Дэлгэрэнгүй">
            <Textarea
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Утас">
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Хаяг">
              <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Latitude"><Input type="number" step="any" value={form.latitude ?? ''} onChange={(e) => set('latitude', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label="Longitude"><Input type="number" step="any" value={form.longitude ?? ''} onChange={(e) => set('longitude', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label="Хүргэлтийн радиус (км)"><Input type="number" step="0.5" value={form.deliveryRadiusKm ?? 5} onChange={(e) => set('deliveryRadiusKm', Number(e.target.value))} /></Field>
          </div>
          <Toggle active={form.isTemporarilyClosed ?? false} onClick={() => set('isTemporarilyClosed', !(form.isTemporarilyClosed ?? false))} title="Түр хаах" subtitle="Идэвхтэй үед шинэ захиалга авахгүй" />
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-[16px] font-semibold">Брэнд</h2>

          <Field label="Брэнд өнгө" hint="Товч, идэвхтэй элемент бүр энэ өнгөөр гарна">
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('accentColor', c)}
                  aria-label={c}
                  className={cn(
                    'size-9 rounded-full transition-transform',
                    form.accentColor === c
                      ? 'ring-2 ring-ink ring-offset-2 scale-110'
                      : 'hover:scale-105',
                  )}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={form.accentColor ?? '#0A0A0A'}
                onChange={(e) => set('accentColor', e.target.value)}
                className="size-9 cursor-pointer rounded-full border border-line bg-transparent"
              />
            </div>
          </Field>

          <Field label="Лого зураг (URL)" hint="Хоосон бол рестораны нэр харагдана">
            <div className="flex items-center gap-3">
              {/* Урьдчилан харах — буруу хаяг оруулбал шууд мэдэгдэнэ. */}
              <SmartImage
                src={form.logoUrl}
                alt={form.name ?? 'Лого'}
                eager
                className="size-11 shrink-0 rounded-[11px] border border-line"
              />
              <Input
                className="flex-1"
                value={form.logoUrl ?? ''}
                onChange={(e) => set('logoUrl', e.target.value)}
              />
            </div>
          </Field>
          <Field label="Ковер зураг (URL)">
            <Input value={form.coverUrl ?? ''} onChange={(e) => set('coverUrl', e.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-[16px] font-semibold">Хүлээн авах боломж</h2>
          <p className="text-[13.5px] text-muted">
            Ресторан бүр хүргэлт хийх албагүй. Хүргэлтийг унтраавал харилцагч
            зөвхөн өөрөө ирж авах болно.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              active={form.deliveryEnabled ?? true}
              onClick={() => set('deliveryEnabled', !(form.deliveryEnabled ?? true))}
              title="Хүргэлттэй"
              subtitle="Хаягаар хүргэж өгнө"
            />
            <Toggle
              active={form.pickupEnabled ?? true}
              onClick={() => set('pickupEnabled', !(form.pickupEnabled ?? true))}
              title="Өөрөө авах"
              subtitle="Ресторанаас өөрөө авна"
            />
          </div>

          {!form.deliveryEnabled && !form.pickupEnabled && (
            <p className="text-[13px] text-bad">
              Дор хаяж нэгийг идэвхтэй үлдээнэ үү — эс бөгөөс захиалга авах боломжгүй.
            </p>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-[16px] font-semibold">Хүргэлт</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Хүргэлтийн төлбөр ₮">
              <Input
                type="number"
                disabled={!form.deliveryEnabled}
                value={form.deliveryFee ?? 0}
                onChange={(e) => set('deliveryFee', Number(e.target.value))}
              />
            </Field>
            <Field label="Хамгийн бага захиалга ₮">
              <Input
                type="number"
                value={form.minOrder ?? 0}
                onChange={(e) => set('minOrder', Number(e.target.value))}
              />
            </Field>
            <Field label="Хүргэх хугацаа (мин)">
              <Input
                type="number"
                value={form.etaMinutes ?? 30}
                onChange={(e) => set('etaMinutes', Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Нээх цаг">
              <Input
                type="time"
                value={form.openTime ?? '09:00'}
                onChange={(e) => set('openTime', e.target.value)}
              />
            </Field>
            <Field label="Хаах цаг">
              <Input
                type="time"
                value={form.closeTime ?? '22:00'}
                onChange={(e) => set('closeTime', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Button type="submit" size="lg" loading={save.isPending}>
          Хадгалах
        </Button>
      </form>
    </Page>
  );
}

/** Асаах/унтраах сонголт — хүлээн авах боломжуудад. */
function Toggle({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-3 rounded-[12px] border px-4 py-3.5 text-left transition-all duration-150',
        active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
          active ? 'border-accent bg-accent' : 'border-line-strong',
        )}
      >
        {active && <Check size={12} className="text-white" />}
      </span>
      <span>
        <span className="block text-[14.5px] font-medium">{title}</span>
        <span className="block text-[12.5px] text-muted">{subtitle}</span>
      </span>
    </button>
  );
}
