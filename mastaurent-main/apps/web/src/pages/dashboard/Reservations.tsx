import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import type { Reservation, ReservationStatus, RestaurantTable } from '../../lib/types';
import { Button, Card, EmptyState, Page, Select, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';

/** Ширээ захиалгын удирдлага — зөвхөн өөрийн рестораных. */
export function DashboardReservations() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReservationStatus | 'ALL'>('PENDING');
  const [date, setDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', status, date],
    queryFn: () =>
      api<{ reservations: Reservation[] }>(
        `/reservations/manage?status=${status}${date ? `&date=${date}` : ''}`,
      ),
    refetchInterval: 15000,
  });

  const { data: tableData } = useQuery({
    queryKey: ['tables'],
    queryFn: () => api<{ tables: RestaurantTable[] }>('/tables'),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: ReservationStatus; tableId?: string }) =>
      api(`/reservations/${id}/status`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Шинэчлэгдлээ');
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Өөрчлөхөд алдаа гарлаа'),
  });

  const reservations = data?.reservations ?? [];
  const tables = tableData?.tables ?? [];

  return (
    <Page className="pt-2">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Ширээ захиалга</h1>
      <p className="mt-1 text-muted">15 секунд тутамд шинэчлэгдэнэ.</p>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'ALL'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-4 py-2 text-[13px] transition-colors',
              status === s
                ? 'border-ink bg-ink text-bg'
                : 'border-line text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {s === 'ALL' ? 'Бүгд' : LABEL[s]}
          </button>
        ))}

        <label className="ml-auto flex items-center gap-2 text-[13px] text-muted">
          <CalendarDays size={15} />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink"
          />
          {date && (
            <button onClick={() => setDate('')} className="text-faint hover:text-ink">
              арилгах
            </button>
          )}
        </label>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !reservations.length ? (
        <EmptyState title="Захиалга алга" description="Энэ шүүлтэд ширээ захиалга байхгүй байна." />
      ) : (
        <ul className="mt-6 space-y-3">
          {reservations.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-[16px] font-medium">{r.customerName}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px]', STYLE[r.status])}>
                        {LABEL[r.status]}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                      <span>{r.customerPhone}</span>
                      <span className="flex items-center gap-1">
                        <Users size={13} /> {r.partySize} хүн
                      </span>
                      <span>
                        {new Date(r.reservedAt).toLocaleDateString('mn-MN')} · {r.reservedTime}
                      </span>
                      <span>{r.table ? `ширээ ${r.table.number}` : 'ширээ сонгоогүй'}</span>
                    </p>
                    {r.note && <p className="mt-2 text-[13px] text-faint">{r.note}</p>}
                  </div>
                </div>

                {ALLOWED[r.status].length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    {r.status === 'PENDING' && (
                      <Select
                        className="max-w-[170px]"
                        value={r.table?.id ?? ''}
                        onChange={(e) =>
                          update.mutate({
                            id: r.id,
                            status: 'PENDING',
                            tableId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Ширээ хуваарилах…</option>
                        {tables
                          .filter((t) => t.capacity >= r.partySize && t.status !== 'OUT_OF_SERVICE')
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.number} · {t.capacity} хүн
                            </option>
                          ))}
                      </Select>
                    )}

                    {ALLOWED[r.status].map((next) => (
                      <Button
                        key={next}
                        variant={next === 'REJECTED' || next === 'CANCELLED' ? 'secondary' : 'primary'}
                        loading={update.isPending}
                        onClick={() => update.mutate({ id: r.id, status: next })}
                      >
                        {ACTION[next]}
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

const LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Хүлээгдэж буй',
  CONFIRMED: 'Баталгаажсан',
  SEATED: 'Суусан',
  COMPLETED: 'Дууссан',
  CANCELLED: 'Цуцлагдсан',
  REJECTED: 'Татгалзсан',
};

const ACTION: Record<ReservationStatus, string> = {
  PENDING: 'Хүлээлгэх',
  CONFIRMED: 'Зөвшөөрөх',
  SEATED: 'Суулгах',
  COMPLETED: 'Дуусгах',
  CANCELLED: 'Цуцлах',
  REJECTED: 'Татгалзах',
};

const STYLE: Record<ReservationStatus, string> = {
  PENDING: 'bg-black/[0.05] text-muted',
  CONFIRMED: 'bg-accent-soft text-accent',
  SEATED: 'bg-ok/10 text-ok',
  COMPLETED: 'bg-ok/10 text-ok',
  CANCELLED: 'bg-bad/10 text-bad',
  REJECTED: 'bg-bad/10 text-bad',
};

/** Сервер дэх шилжилтийн дүрэмтэй ижил — товч зөвхөн боломжтойг харуулна. */
const ALLOWED: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: ['SEATED', 'CANCELLED'],
  SEATED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};
