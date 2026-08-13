import type { OrderStatus, OrderType } from './types';

/** 24500 -> "24,500₮" */
export const mnt = (value: number) => `${value.toLocaleString('mn-MN')}₮`;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'дөнгөж сая';
  if (min < 60) return `${min} мин өмнө`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'өчигдөр' : `${days} хоногийн өмнө`;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Хүлээгдэж буй',
  CONFIRMED: 'Баталгаажсан',
  PREPARING: 'Бэлтгэж буй',
  READY: 'Авахад бэлэн',
  DELIVERING: 'Хүргэлтэнд гарсан',
  COMPLETED: 'Хүргэгдсэн',
  CANCELLED: 'Цуцлагдсан',
  REJECTED: 'Татгалзсан',
};

/** [цэг, текст] — badge болон timeline-д. */
export const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: 'bg-warn/10 text-warn',
  CONFIRMED: 'bg-blue-500/10 text-blue-600',
  PREPARING: 'bg-violet-500/10 text-violet-600',
  READY: 'bg-sky-500/10 text-sky-600',
  DELIVERING: 'bg-sky-500/10 text-sky-600',
  COMPLETED: 'bg-ok/10 text-ok',
  CANCELLED: 'bg-bad/10 text-bad',
  REJECTED: 'bg-bad/10 text-bad',
};

/**
 * Хүлээн авах хэлбэрээс хамаарсан урсгал — серверийн дүрэмтэй ижил.
 *   DELIVERY: … PREPARING → READY (цааш нь жолооч удирдана)
 *   PICKUP:   … PREPARING → READY      → COMPLETED
 */
export function statusFlow(type: OrderType = 'DELIVERY'): OrderStatus[] {
  return type === 'DELIVERY'
    ? ['PENDING', 'CONFIRMED', 'PREPARING', 'READY']
    : ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
}

/** Хуучин хэрэглээнд зориулсан анхдагч (хүргэлт). */
export const STATUS_FLOW: OrderStatus[] = statusFlow('DELIVERY');

/** Дараагийн логик төлөв — dashboard-ийн нэг товчийн урсгал. */
export function nextStatus(status: OrderStatus, type: OrderType = 'DELIVERY'): OrderStatus | null {
  const flow = statusFlow(type);
  const i = flow.indexOf(status);
  if (i === -1 || i === flow.length - 1) return null;
  return flow[i + 1];
}

export const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: 'Баталгаажуулах',
  CONFIRMED: 'Бэлтгэж эхлэх',
  PREPARING: 'Хүргэлтэд бэлэн болгох',
};

/** PICKUP захиалгад товчны бичиг өөр. */
export const NEXT_LABEL_PICKUP: Partial<Record<OrderStatus, string>> = {
  ...NEXT_LABEL,
  PREPARING: 'Бэлэн болсон',
  READY: 'Хүлээлгэж өгсөн',
};

export const nextLabel = (status: OrderStatus, type: OrderType = 'DELIVERY') =>
  (type === 'DELIVERY' ? NEXT_LABEL : NEXT_LABEL_PICKUP)[status];

export const DISTRICTS = [
  'Сүхбаатар дүүрэг',
  'Баянзүрх дүүрэг',
  'Хан-Уул дүүрэг',
  'Чингэлтэй дүүрэг',
  'Баянгол дүүрэг',
  'Сонгинохайрхан дүүрэг',
];
