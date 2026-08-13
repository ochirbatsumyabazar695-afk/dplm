import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ReceiptText } from 'lucide-react';
import { api } from '../../lib/api';
import { STATUS_LABEL, STATUS_STYLE, mnt, relativeTime } from '../../lib/format';
import type { Order } from '../../lib/types';
import { useMember } from '../../store/auth';
import { Badge, Button, Card, EmptyState, Page, Skeleton } from '../../components/ui';

export function StorefrontOrders() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user, ready } = useMember(slug);
  const qc = useQueryClient();
  const cancel = useMutation({ mutationFn: (id: string) => api(`/orders/mine/${id}/cancel`, { method: 'PATCH' }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-orders', slug] }) });

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', slug],
    queryFn: () => api<{ orders: Order[] }>('/orders/mine'),
    enabled: !!user,
    refetchInterval: 15000,
  });

  return (
    <Page className="mx-auto max-w-2xl px-5 pt-8 sm:px-8">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Миний захиалга</h1>

      <p className="mt-2 text-[13.5px] text-muted">
        Захиалга өгсний дараа хянах холбоос үүснэ. Нэвтэрсэн бол захиалгууд энд
        хадгалагдана.
      </p>

      {!ready ? (
        // Гишүүнчлэл тодрох хүртэл "нэвтэрч орно уу" гэж БҮҮ хэл.
        <Skeleton className="mt-6 h-28" />
      ) : !user ? (
        <EmptyState
          icon={<ReceiptText size={30} strokeWidth={1.5} />}
          title="Нэвтэрч орно уу"
          description="Нэвтэрснээр захиалгын түүх хадгалагдана."
          action={
            <div className="flex gap-2">
              <Button onClick={() => navigate(`/t/${slug}/login`)}>Нэвтрэх</Button>
              <Button variant="secondary" onClick={() => navigate(`/t/${slug}/register`)}>
                Бүртгүүлэх
              </Button>
            </div>
          }
        />
      ) : isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !data?.orders.length ? (
        <EmptyState
          icon={<ReceiptText size={30} strokeWidth={1.5} />}
          title="Захиалга алга"
          description="Эхний захиалгаа өгөөд эндээс хянаарай."
          action={<Button onClick={() => navigate(`/t/${slug}/menu`)}>Цэс үзэх</Button>}
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {data.orders.map((order) => (
            <li key={order.id}>
              <Link to={`/t/${slug}/order/${order.trackToken}`}>
                <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-strong">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[15px] font-medium">#{order.orderNo}</span>
                      <Badge className={STATUS_STYLE[order.status]}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[13.5px] text-muted">
                      {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                    </p>
                    <p className="mt-1 text-[12.5px] text-faint">{relativeTime(order.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-semibold tabular-nums">{mnt(order.total)}</p>
                    {order.status === 'PENDING' && <button className="mt-2 text-xs text-bad underline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancel.mutate(order.id); }}>Цуцлах</button>}
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-faint" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
