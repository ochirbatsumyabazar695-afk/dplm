import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, EmptyState, Skeleton } from '../../components/ui';

type KitchenOrder = { id: string; orderNo: number; type: string; note: string | null; status: string; createdAt: string; items: { id: string; name: string; quantity: number; options: string }[] };

export function KitchenDashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['kitchen-orders'], queryFn: () => api<{ orders: KitchenOrder[] }>('/orders/kitchen') });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/orders/${id}/kitchen-status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  });
  if (isLoading) return <Skeleton className="h-72" />;
  const orders = data?.orders ?? [];
  if (!orders.length) return <EmptyState title="Бэлтгэх захиалга алга" description="Шинэ захиалга энд автоматаар харагдана." />;
  return <div className="space-y-4">
    <header><p className="label">Гал тогоо</p><h1 className="mt-2 text-3xl">Бэлтгэх захиалгууд</h1></header>
    {orders.map((o) => <article key={o.id} className="border border-line bg-paper p-5">
      <div className="flex items-center justify-between"><strong>#{o.orderNo}</strong><span className="label">{o.type} · {o.status}</span></div>
      <ul className="my-4 space-y-2">{o.items.map((i) => <li key={i.id}>{i.quantity}× {i.name}{i.options ? ` — ${i.options}` : ''}</li>)}</ul>
      {o.note && <p className="mb-4 text-sm text-muted">Тэмдэглэл: {o.note}</p>}
      <div className="flex gap-2">
        {o.status === 'PENDING' && <Button onClick={() => update.mutate({ id: o.id, status: 'CONFIRMED' })}>Хүлээн авах</Button>}
        {o.status === 'CONFIRMED' && <Button onClick={() => update.mutate({ id: o.id, status: 'PREPARING' })}>Бэлтгэж эхлэх</Button>}
        {o.status === 'PREPARING' && <Button onClick={() => update.mutate({ id: o.id, status: 'READY' })}>Бэлэн болсон</Button>}
      </div>
    </article>)}
  </div>;
}
