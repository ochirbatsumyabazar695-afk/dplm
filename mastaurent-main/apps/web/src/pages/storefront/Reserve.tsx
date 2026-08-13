import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CalendarCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import type { Reservation, ReservationStatus, RestaurantTable } from '../../lib/types';
import { useTenant } from '../../layouts/StorefrontLayout';
import { useMember } from '../../store/auth';
import { Button, Card, Field, Input, Page, Select, Textarea } from '../../components/ui';
import { cn } from '../../lib/cn';

/** Харилцагч ширээ захиална. Ресторан хянаж зөвшөөрнө. */
const schema = z.object({
  customerName: z.string().min(2, 'Нэрээ оруулна уу'),
  customerPhone: z.string().regex(/^\d{8}$/, 'Утасны дугаар 8 оронтой тоо байна'),
  partySize: z.coerce.number().int().min(1, 'Хүний тоо 1-ээс их').max(50),
  reservedDate: z.string().min(1, 'Огноо сонгоно уу'),
  reservedTime: z.string().regex(/^\d{2}:\d{2}$/, 'Цаг HH:MM хэлбэртэй'),
  tableId: z.string().optional(),
  note: z.string().max(300).optional(),
});

type Values = z.input<typeof schema>;

export function Reserve() {
  const { slug = '' } = useParams();
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const { user, isSignedIn } = useMember(slug);
  const [partySize, setPartySize] = useState(2);

  const { data: tableData } = useQuery({
    queryKey: ['public-tables', slug],
    queryFn: () => api<{ tables: RestaurantTable[] }>('/tables/public'),
  });

  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ['my-reservations', slug],
    queryFn: () => api<{ reservations: Reservation[] }>('/reservations/mine'),
    enabled: isSignedIn,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: user?.name ?? '',
      customerPhone: user?.phone ?? '',
      partySize: 2,
      reservedDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
      reservedTime: '19:00',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      api<{ reservation: Reservation }>('/reservations', {
        method: 'POST',
        body: { ...values, partySize: Number(values.partySize), tableId: values.tableId || undefined },
      }),
    onSuccess: () => {
      toast.success('Ширээ захиалга илгээгдлээ');
      void queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Захиалахад алдаа гарлаа'),
  });

  // Сонгосон хүний тоонд багтах ширээ л харуулна.
  const tables = (tableData?.tables ?? []).filter((t) => t.capacity >= partySize);

  return (
    <Page className="mx-auto max-w-lg px-5 pt-8 sm:px-8">
      <Link
        to={`/t/${slug}`}
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> {tenant.name}
      </Link>

      <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Ширээ захиалах</h1>
      <p className="mt-1 text-muted">
        {tenant.openTime}—{tenant.closeTime} · захиалгыг ресторан баталгаажуулна
      </p>

      {isSignedIn && !mineLoading && (mine?.reservations.length ?? 0) > 0 && (
        <ul className="mt-7 space-y-3">
          {mine!.reservations.slice(0, 4).map((r) => (
            <li key={r.id}>
              <Card className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 text-[13.5px]">
                  <p className="font-medium">
                    {new Date(r.reservedAt).toLocaleDateString('mn-MN')} · {r.reservedTime}
                  </p>
                  <p className="mt-0.5 text-muted">
                    {r.partySize} хүн {r.table ? `· ширээ ${r.table.number}` : ''}
                  </p>
                  {r.reviewNote && <p className="mt-1 text-faint">{r.reviewNote}</p>}
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px]', STYLE[r.status])}>
                  {LABEL[r.status]}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-7 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Нэр" error={errors.customerName?.message}>
            <Input placeholder="Батбаяр" {...register('customerName')} />
          </Field>
          <Field label="Утас" error={errors.customerPhone?.message}>
            <Input inputMode="numeric" placeholder="99112233" {...register('customerPhone')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Огноо" error={errors.reservedDate?.message}>
            <Input type="date" {...register('reservedDate')} />
          </Field>
          <Field label="Цаг" error={errors.reservedTime?.message}>
            <Input type="time" {...register('reservedTime')} />
          </Field>
          <Field label="Хүний тоо" error={errors.partySize?.message}>
            <Input
              inputMode="numeric"
              {...register('partySize', {
                onChange: (e) => setPartySize(Number(e.target.value) || 1),
              })}
            />
          </Field>
        </div>

        <Field
          label="Ширээ"
          hint={tables.length ? 'Заавал биш — ресторан ч хуваарилж болно' : 'Тохирох ширээ алга'}
        >
          <Select {...register('tableId')}>
            <option value="">Ресторан сонгоно</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.number} · {t.capacity} хүн
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Нэмэлт хүсэлт" hint="Заавал биш" error={errors.note?.message}>
          <Textarea placeholder="Цонхны дэргэд, төрсөн өдөр..." {...register('note')} />
        </Field>

        <Button type="submit" full size="lg" loading={mutation.isPending}>
          <CalendarCheck size={17} />
          Захиалга илгээх
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[12.5px] text-faint">
          <Users size={13} />
          Ресторан баталгаажуулмагц утсаар мэдэгдэнэ
        </p>
      </form>
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

const STYLE: Record<ReservationStatus, string> = {
  PENDING: 'bg-black/[0.05] text-muted',
  CONFIRMED: 'bg-accent-soft text-accent',
  SEATED: 'bg-ok/10 text-ok',
  COMPLETED: 'bg-ok/10 text-ok',
  CANCELLED: 'bg-bad/10 text-bad',
  REJECTED: 'bg-bad/10 text-bad',
};
