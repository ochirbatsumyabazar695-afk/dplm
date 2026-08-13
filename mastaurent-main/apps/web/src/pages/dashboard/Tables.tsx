import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import QRCode from 'qrcode';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import type { RestaurantTable, TableStatus, Tenant } from '../../lib/types';
import { Button, Card, EmptyState, Field, Input, Page, Select, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';

/** Ширээний удирдлага — зөвхөн өөрийн рестораны ширээ. */
export function DashboardTables() {
  const tenant = useOutletContext<Tenant>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RestaurantTable | 'new' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api<{ tables: RestaurantTable[] }>('/tables'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tables'] });
  const fail = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Алдаа гарлаа');

  const save = useMutation({
    mutationFn: ({ id, ...body }: Partial<RestaurantTable> & { id?: string }) =>
      id
        ? api(`/tables/${id}`, { method: 'PATCH', body })
        : api('/tables', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Хадгаллаа');
      setEditing(null);
      void refresh();
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/tables/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Ширээ устлаа');
      void refresh();
    },
    onError: fail,
  });

  const tables = data?.tables ?? [];

  return (
    <Page className="pt-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Ширээ</h1>
          <p className="mt-1 text-muted">{tables.length} ширээ бүртгэлтэй</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          Ширээ нэмэх
        </Button>
      </div>

      {editing && (
        <TableForm
          table={editing === 'new' ? null : editing}
          busy={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(values) => save.mutate(values)}
        />
      )}

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !tables.length ? (
        <EmptyState
          title="Ширээ алга"
          description="Эхний ширээгээ нэмээд ширээ захиалга хүлээн авч эхлээрэй."
        />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[20px] font-semibold tracking-[-0.02em]">{t.number}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{t.capacity} хүн</p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap',
                    STATUS_STYLE[t.status],
                  )}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </div>

              {t.note && <p className="mt-3 text-[13px] text-muted">{t.note}</p>}
              {t.qrToken && <TableQr table={t} slug={tenant.slug} />}

              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <button
                  onClick={() => setEditing(t)}
                  className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
                >
                  <Pencil size={14} /> Засах
                </button>
                <button
                  onClick={() => remove.mutate(t.id)}
                  className="ml-auto flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-bad"
                >
                  <Trash2 size={14} /> Устгах
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

function TableQr({ table, slug }: { table: RestaurantTable; slug: string }) {
  const [src, setSrc] = useState('');
  const url = `${window.location.origin}/t/${slug}/menu?table=${table.qrToken}`;
  useEffect(() => { void QRCode.toDataURL(url, { width: 320, margin: 2 }).then(setSrc); }, [url]);
  if (!src) return null;
  return <div className="mt-4 border-t border-line pt-4 text-center">
    <img src={src} alt={`${table.number} QR`} className="mx-auto size-40" />
    <p className="mt-2 text-xs text-muted">{table.number} — давтагдашгүй QR</p>
    <div className="mt-3 flex justify-center gap-2">
      <a href={src} download={`${slug}-${table.number}-qr.png`} className="rounded-full border border-line px-3 py-2 text-xs hover:border-ink">QR татах</a>
      <button onClick={() => { void navigator.clipboard.writeText(url); toast.success('QR холбоос хуулагдлаа'); }} className="rounded-full border border-line px-3 py-2 text-xs hover:border-ink">Холбоос хуулах</button>
    </div>
  </div>;
}

const STATUS_LABEL: Record<TableStatus, string> = {
  AVAILABLE: 'Сул',
  OCCUPIED: 'Хүнтэй',
  RESERVED: 'Захиалагдсан',
  OUT_OF_SERVICE: 'Ашиглалтгүй',
};

const STATUS_STYLE: Record<TableStatus, string> = {
  AVAILABLE: 'bg-ok/10 text-ok',
  OCCUPIED: 'bg-accent-soft text-accent',
  RESERVED: 'bg-black/[0.05] text-muted',
  OUT_OF_SERVICE: 'bg-bad/10 text-bad',
};

function TableForm({
  table,
  busy,
  onCancel,
  onSave,
}: {
  table: RestaurantTable | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: Partial<RestaurantTable> & { id?: string }) => void;
}) {
  const [number, setNumber] = useState(table?.number ?? '');
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 2));
  const [status, setStatus] = useState<TableStatus>(table?.status ?? 'AVAILABLE');
  const [note, setNote] = useState(table?.note ?? '');

  return (
    <Card className="mt-6 space-y-4 p-6">
      <h2 className="text-[16px] font-semibold">{table ? 'Ширээ засах' : 'Шинэ ширээ'}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Дугаар">
          <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="A1" />
        </Field>
        <Field label="Багтаамж">
          <Input
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="4"
          />
        </Field>
        <Field label="Төлөв">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TableStatus)}>
            {(Object.keys(STATUS_LABEL) as TableStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Тэмдэглэл" hint="Заавал биш">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Цонхны дэргэд" />
      </Field>

      <div className="flex gap-2">
        <Button
          loading={busy}
          onClick={() => {
            const cap = Number(capacity);
            if (!number.trim()) return toast.error('Дугаар оруулна уу');
            if (!Number.isInteger(cap) || cap < 1) return toast.error('Багтаамж буруу байна');
            onSave({
              id: table?.id,
              number: number.trim(),
              capacity: cap,
              status,
              note: note.trim() || null,
            });
          }}
        >
          Хадгалах
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Болих
        </Button>
      </div>
    </Card>
  );
}
