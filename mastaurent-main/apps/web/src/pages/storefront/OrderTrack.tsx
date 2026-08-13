import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../../lib/config';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChefHat,
  CircleCheck,
  ClipboardCheck,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { STATUS_LABEL, mnt, statusFlow, time } from '../../lib/format';
import type { Order, OrderStatus } from '../../lib/types';
import { useTenant } from '../../layouts/StorefrontLayout';
import { Badge, Card, Page, Skeleton, SmartImage } from '../../components/ui';
import { cn } from '../../lib/cn';

const STEP_ICON: Record<OrderStatus, typeof Check> = {
  PENDING: ClipboardCheck,
  CONFIRMED: CircleCheck,
  PREPARING: ChefHat,
  READY: PackageCheck,
  DELIVERING: Truck,
  COMPLETED: Check,
  CANCELLED: XCircle,
  REJECTED: XCircle,
};

const STEP_HINT: Record<string, string> = {
  PENDING: 'Ресторан захиалгыг хүлээж авлаа',
  CONFIRMED: 'Ресторан баталгаажууллаа',
  PREPARING: 'Тогооч хоолыг бэлтгэж байна',
  READY: 'Захиалга бэлэн — ресторанаас аваарай',
  DELIVERING: 'Жолооч замдаа гарлаа',
  COMPLETED: 'Сайхан хооллоорой!',
  REJECTED: 'Ресторан захиалгыг татгалзсан',
};

export function OrderTrack() {
  const { slug = '', token = '' } = useParams();
  const tenant = useTenant();
  const qc = useQueryClient();
  const [driverPoint, setDriverPoint] = useState<{ latitude: number; longitude: number; at?: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order', slug, token],
    queryFn: () => api<{ order: Order }>(`/orders/track/${token}`),
    refetchInterval: 10000, // төлөв өөрчлөгдвөл автоматаар шинэчилнэ
  });
  useQuery({ queryKey: ['driver-location', token], queryFn: async () => { const d = await api<{ location: { currentLat: number; currentLng: number; lastPingAt: string } | null }>(`/locations/track/${token}`); if (d.location) setDriverPoint({ latitude: d.location.currentLat, longitude: d.location.currentLng, at: d.location.lastPingAt }); return d; }, refetchInterval: 5000 });
  useEffect(() => { const socket = io(SOCKET_URL); socket.emit('track-order', token); socket.on('driver-location', (p) => setDriverPoint(p)); socket.on('order-status', () => void qc.invalidateQueries({ queryKey: ['order', slug, token] })); return () => { socket.disconnect(); }; }, [token, slug, qc]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 pt-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Page className="mx-auto max-w-2xl px-5 pt-24 text-center">
        <p className="label">Олдсонгүй</p>
        <h1 className="mt-4 text-[clamp(26px,4vw,42px)] tracking-[-0.04em]">Захиалга байхгүй</h1>
        <p className="mt-2 text-muted">Хянах холбоос буруу эсвэл хуучирсан байна.</p>
        <Link
          to={`/t/${slug}/orders`}
          className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-bg transition-opacity hover:opacity-85"
        >
          Буцах
        </Link>
      </Page>
    );
  }

  const order = data.order;
  const cancelled = order.status === 'CANCELLED';
  const flow = statusFlow(order.type);
  const currentIndex = flow.indexOf(order.status);

  return (
    <Page className="mx-auto max-w-2xl px-5 pt-8 sm:px-8">
      <Link
        to={`/t/${slug}/orders`}
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Захиалгууд
      </Link>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Захиалга #{order.orderNo}</h1>
          <p className="mt-1 text-muted">
            {tenant.name} · {time(order.createdAt)}
          </p>
        </div>
        <span className="text-[20px] font-semibold tabular-nums">{mnt(order.total)}</span>
      </div>

      {/* Явц */}
      <Card className="mt-6 p-6">
        {cancelled ? (
          <div className="flex items-center gap-3 text-bad">
            <XCircle size={20} />
            <div>
              <p className="font-medium">Захиалга цуцлагдсан</p>
              <p className="text-[13.5px] text-muted">
                Дэлгэрэнгүйг {tenant.phone} утсаар лавлана уу.
              </p>
            </div>
          </div>
        ) : (
          <ol className="relative space-y-6">
            {flow.map((step, i) => {
              const done = i <= currentIndex;
              const active = i === currentIndex;
              const Icon = STEP_ICON[step];

              return (
                <li key={step} className="flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <motion.span
                      initial={false}
                      animate={{
                        backgroundColor: done ? 'var(--accent)' : '#ffffff',
                        borderColor: done ? 'var(--accent)' : '#eaeaea',
                        scale: active ? 1.08 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className="z-10 grid size-9 place-items-center rounded-full border"
                    >
                      <Icon size={16} className={done ? 'text-white' : 'text-faint'} />
                      {active && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-20" />
                      )}
                    </motion.span>
                    {i < flow.length - 1 && (
                      <span
                        className={cn(
                          'absolute top-9 h-[calc(100%+1rem)] w-px transition-colors duration-500',
                          i < currentIndex ? 'bg-accent' : 'bg-line',
                        )}
                      />
                    )}
                  </div>

                  <div className="pb-1">
                    <p
                      className={cn(
                        'text-[15px] font-medium transition-colors',
                        done ? 'text-ink' : 'text-faint',
                      )}
                    >
                      {STATUS_LABEL[step]}
                    </p>
                    {active && (
                      <motion.p
                        initial={{ opacity: 0, y: -3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[13.5px] text-muted"
                      >
                        {STEP_HINT[step]}
                      </motion.p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      {order.type === 'DELIVERY' && order.deliveryCode && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
        <Card className="mt-4 border-accent p-6 text-center">
          <p className="label">Хүргэлт баталгаажуулах код</p>
          <p className="mt-3 font-mono text-4xl font-semibold tracking-[0.22em]">{order.deliveryCode}</p>
          <p className="mt-3 text-sm text-muted">Хоолоо гардан авсны дараа энэ кодыг жолоочид хэлнэ үү.</p>
        </Card>
      )}
      {driverPoint && <Card className="mt-4 overflow-hidden p-0"><iframe title="Жолоочийн амьд байршил" className="h-72 w-full border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverPoint.longitude-0.012}%2C${driverPoint.latitude-0.012}%2C${driverPoint.longitude+0.012}%2C${driverPoint.latitude+0.012}&marker=${driverPoint.latitude}%2C${driverPoint.longitude}`} /><div className="p-5"><p className="font-medium">Жолоочийн амьд байршил</p><p className="mt-1 text-sm text-muted">Сүүлд шинэчлэгдсэн: {driverPoint.at ? new Date(driverPoint.at).toLocaleTimeString('mn-MN') : 'одоо'}</p></div></Card>}

      {/* Дэлгэрэнгүй */}
      <Card className="mt-4 p-5">
        <h2 className="text-[16px] font-semibold">Захиалсан хоол</h2>
        <ul className="mt-3 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <SmartImage
                src={item.imageUrl}
                alt={item.name}
                className="size-12 shrink-0 rounded-[9px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px]">
                  <span className="text-muted">{item.quantity}×</span> {item.name}
                </p>
                {item.options && <p className="text-[12.5px] text-faint">{item.options}</p>}
              </div>
              <span className="shrink-0 text-[14px] tabular-nums">{mnt(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-[14px]">
          <div className="flex justify-between text-muted">
            <span>Дүн</span>
            <span className="tabular-nums">{mnt(order.subtotal)}</span>
          </div>
          {/* Очиж авах захиалгад хүргэлтийн төлбөр байхгүй. */}
          {order.type === 'DELIVERY' && (
            <div className="flex justify-between text-muted">
              <span>Хүргэлт</span>
              <span className="tabular-nums">{mnt(order.deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 font-semibold">
            <span>Нийт</span>
            <span className="tabular-nums">{mnt(order.total)}</span>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[16px] font-semibold">
          {order.type === 'PICKUP' ? 'Ресторанаас авах' : 'Хүргэлт'}
        </h2>
        <div className="mt-3 space-y-2 text-[14px]">
          <Line label="Хүлээн авагч" value={`${order.customerName} · ${order.customerPhone}`} />
          {order.type === 'DELIVERY' ? (
            <Line label="Хаяг" value={`${order.district}, ${order.addressLine}`} />
          ) : (
            <Line label="Авах газар" value={tenant.address ?? tenant.name} />
          )}
          {order.note && <Line label="Тэмдэглэл" value={order.note} />}
          <div className="flex justify-between gap-6">
            <span className="text-muted">Төлбөр</span>
            <Badge className={order.isPaid ? 'bg-ok/10 text-ok' : 'bg-black/[0.05] text-muted'}>
              {order.paymentMethod === 'CASH' ? 'Бэлнээр' : 'Картаар'} ·{' '}
              {order.isPaid ? 'төлөгдсөн' : 'төлөгдөөгүй'}
            </Badge>
          </div>
        </div>
      </Card>
    </Page>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
