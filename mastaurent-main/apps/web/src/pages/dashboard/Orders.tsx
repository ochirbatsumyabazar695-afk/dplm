import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../../lib/config';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, Phone, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api, getLocalToken } from '../../lib/api';
import {
  nextLabel,
  STATUS_LABEL,
  STATUS_STYLE,
  mnt,
  nextStatus,
  relativeTime,
  time,
} from '../../lib/format';
import type { Order, OrderStatus, Stats } from '../../lib/types';
import { Badge, Button, Card, EmptyState, Page, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';

const FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Бүгд' },
  { value: 'PENDING', label: 'Шинэ' },
  { value: 'CONFIRMED', label: 'Баталгаажсан' },
  { value: 'PREPARING', label: 'Бэлтгэж буй' },
  { value: 'DELIVERING', label: 'Хүргэлтэнд' },
  { value: 'COMPLETED', label: 'Дууссан' },
];

export function DashboardOrders() {
  const [filter, setFilter] = useState('ALL');
  const qc = useQueryClient();
  useEffect(() => {
    const socket = io(SOCKET_URL);
    const token = getLocalToken();
    if (token) socket.emit('join-tenant', token);
    socket.on('new-order', (order: { orderNo: number }) => {
      void qc.invalidateQueries({ queryKey: ['dash-orders'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Шинэ захиалга #${order.orderNo}`);
      try { const audio = new Audio('data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgA=='); void audio.play(); } catch { /* browser policy */ }
    });
    return () => { socket.disconnect(); };
  }, [qc]);

  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => api<Stats>('/orders/stats'),
    refetchInterval: 20000,
  });

  const orders = useQuery({
    queryKey: ['dash-orders', filter],
    queryFn: () => api<{ orders: Order[] }>(`/orders/manage?status=${filter}`),
    refetchInterval: 10000, // шинэ захиалга автоматаар гарч ирнэ
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api<{ order: Order }>(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: ({ order }) => {
      toast.success(`#${order.orderNo} → ${STATUS_LABEL[order.status]}`);
      void qc.invalidateQueries({ queryKey: ['dash-orders'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: () => toast.error('Төлөв солиход алдаа гарлаа'),
  });

  return (
    <Page>
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Захиалга</h1>
      <p className="mt-1 text-muted">Шинэ захиалга 10 секунд тутамд шинэчлэгдэнэ.</p>

      {/* Статистик */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : stats.data && (
              <>
                <StatCard
                  icon={<Wallet size={16} />}
                  label="Өнөөдрийн орлого"
                  value={mnt(stats.data.todayRevenue)}
                  sub={`${stats.data.todayOrders} захиалга`}
                />
                <StatCard
                  icon={<ClipboardList size={16} />}
                  label="Идэвхтэй захиалга"
                  value={String(stats.data.activeOrders)}
                  sub="хүргэгдээгүй"
                  accent
                />
                <StatCard
                  icon={<TrendingUp size={16} />}
                  label="Нийт орлого"
                  value={mnt(stats.data.totalRevenue)}
                  sub={`${stats.data.completedOrders} дууссан`}
                />
                <StatCard
                  icon={<TrendingUp size={16} />}
                  label="Дундаж захиалга"
                  value={mnt(stats.data.avgOrder)}
                  sub={stats.data.topItems[0] ? `Топ: ${stats.data.topItems[0].name}` : '—'}
                />
              </>
            )}
      </div>

      {/* Шүүлтүүр */}
      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'relative shrink-0 rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors',
                active ? 'border-transparent text-white' : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Жагсаалт */}
      {orders.isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !orders.data?.orders.length ? (
        <EmptyState
          icon={<ClipboardList size={30} strokeWidth={1.5} />}
          title="Захиалга алга"
          description="Энэ төлөвт захиалга байхгүй байна."
        />
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {orders.data.orders.map((order) => {
              const next = nextStatus(order.status, order.type);
              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                >
                  <Card className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[16px] font-semibold">#{order.orderNo}</span>
                          <Badge className={STATUS_STYLE[order.status]}>
                            {STATUS_LABEL[order.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[13px] text-muted">
                          {time(order.createdAt)} · {relativeTime(order.createdAt)}
                        </p>
                      </div>
                      <span className="text-[17px] font-semibold tabular-nums">
                        {mnt(order.total)}
                      </span>
                    </div>

                    <ul className="mt-3 space-y-1 text-[13.5px]">
                      {order.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate">
                            <span className="text-muted">{i.quantity}×</span> {i.name}
                            {i.options && <span className="text-faint"> — {i.options}</span>}
                          </span>
                          <span className="shrink-0 text-muted tabular-nums">{mnt(i.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 space-y-1 border-t border-line pt-3 text-[13px] text-muted">
                      <p className="flex items-center gap-2">
                        <Phone size={13} />
                        {order.customerName} · {order.customerPhone}
                      </p>
                      <p>
                        {order.table ? `${order.table.number} · QR ширээний захиалга` : order.type === 'PICKUP' ? 'Өөрөө авах' : `${order.district ?? ''} ${order.addressLine ?? ''}`}
                      </p>
                      {order.note && (
                        <p className="border-l-2 border-warn pl-2.5 text-warn">{order.note}</p>
                      )}
                    </div>

                    {(next || order.status !== 'CANCELLED') && (
                      <div className="mt-4 flex gap-2">
                        {next && (
                          <Button
                            size="sm"
                            className="flex-1"
                            loading={update.isPending && update.variables?.id === order.id}
                            onClick={() => update.mutate({ id: order.id, status: next })}
                          >
                            {nextLabel(order.status, order.type) ?? 'Дараагийн алхам'}
                          </Button>
                        )}
                        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => update.mutate({ id: order.id, status: 'CANCELLED' })}
                          >
                            Цуцлах
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Page>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className={cn('flex items-center gap-2 text-[12.5px]', accent ? 'text-accent' : 'text-muted')}>
        {icon}
        {label}
      </div>
      <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="mt-0.5 text-[12.5px] text-faint">{sub}</p>
    </Card>
  );
}
