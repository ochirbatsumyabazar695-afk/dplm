import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, api } from '../../lib/api';
import { Button, EmptyState, Skeleton } from '../../components/ui';

type Driver = {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  isOnline: boolean;
  currentLat: number | null;
  currentLng: number | null;
};
type Order = {
  id: string;
  orderNo: number;
  type: string;
  status: string;
  deliveryStatus: string | null;
  customerName: string;
  driver: { id: string; name: string } | null;
};

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function DispatchDashboard() {
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ['dispatch-orders'],
    queryFn: () => api<{ orders: Order[] }>('/orders/manage'),
  });
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => api<{ staff: Driver[] }>('/staff') });

  const assign = useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string }) =>
      api(`/deliveries/${id}/assign`, { method: 'POST', body: { driverId } }),
    onSuccess: () => {
      toast.success('Жолооч оноогдлоо');
      void qc.invalidateQueries({ queryKey: ['dispatch-orders'] });
    },
    onError: (e) => toast.error(message(e, 'Жолооч онооход алдаа гарлаа')),
  });

  if (orders.isLoading || staff.isLoading) return <Skeleton className="h-72" />;

  // Хоосон жагсаалт биш, шалтгааныг нь харуулна — 403 үед хуудас эвдэрсэн
  // мэт харагдахаас сэргийлнэ.
  if (orders.isError || staff.isError) {
    return (
      <EmptyState
        title="Хүргэлтийн мэдээллийг харах боломжгүй"
        description={message(orders.error ?? staff.error, 'Дахин оролдоно уу.')}
      />
    );
  }

  const rows = (orders.data?.orders ?? []).filter(
    (o) => o.type === 'DELIVERY' && !['COMPLETED', 'CANCELLED'].includes(o.status),
  );

  // Сервер оноохдоо зөвхөн isActive шаарддаг — isOnline-г ШААРДДАГГҮЙ.
  // Урьд нь энд онлайн эсэхээр шүүдэг байсан тул хэн ч апп нээгээгүй үед
  // оноох товч огт гарахгүй, шалтгаан нь ч тайлбарлагдахгүй байв.
  const drivers = (staff.data?.staff ?? []).filter((s) => s.role === 'DRIVER' && s.isActive);
  const located = drivers.filter((d) => d.currentLat != null && d.currentLng != null);
  const pin = located[0];

  return (
    <div className="space-y-5">
      <header>
        <p className="label">Хүргэлтийн удирдлага</p>
        <h1 className="mt-2 text-3xl">Жолооч оноох</h1>
      </header>

      {pin && (
        <figure>
          <iframe
            title={`${pin.name}-ийн байршил`}
            className="h-72 w-full border border-line"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${pin.currentLng! - 0.02}%2C${pin.currentLat! - 0.02}%2C${pin.currentLng! + 0.02}%2C${pin.currentLat! + 0.02}&marker=${pin.currentLat}%2C${pin.currentLng}`}
          />
          <figcaption className="mt-2 text-[13px] text-muted">
            {pin.name} · сүүлд мэдэгдсэн байршил
            {located.length > 1 && ` (байршилтай ${located.length} жолоочийн эхнийх)`}
          </figcaption>
        </figure>
      )}

      {!drivers.length && (
        <p className="border border-line bg-paper p-4 text-[13.5px] text-muted">
          Энэ ресторанд идэвхтэй жолооч алга. «Ажилтан» хэсгээс DRIVER эрхтэй хүн нэмнэ үү.
        </p>
      )}

      {!rows.length ? (
        <EmptyState title="Идэвхтэй хүргэлт алга" />
      ) : (
        rows.map((o) => (
          <article
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-4 border border-line p-5"
          >
            <div>
              <strong>
                #{o.orderNo} · {o.customerName}
              </strong>
              <p className="text-sm text-muted">
                {o.deliveryStatus ?? o.status} · {o.driver?.name ?? 'Жолооч оноогоогүй'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {drivers.map((d) => (
                <Button
                  key={d.id}
                  size="sm"
                  variant={o.driver?.id === d.id ? 'primary' : 'secondary'}
                  onClick={() => assign.mutate({ id: o.id, driverId: d.id })}
                >
                  {d.name}
                  {d.isOnline ? ' ·  онлайн' : ''}
                </Button>
              ))}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
