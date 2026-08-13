import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ChefHat, Clock3, ExternalLink, MapPin, Navigation, PackageCheck, Phone, Radio, Store, Truck } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import { toast } from 'sonner';

type Delivery = { id: string; orderNo: number; customerName: string; customerPhone: string; district: string | null; addressLine: string | null; deliveryLat: number | null; deliveryLng: number | null; status: string; deliveryStatus: string; createdAt: string; tenant: { name: string; address: string | null; phone: string | null } };

const DELIVERY_META: Record<string, { label: string; tone: string; icon: typeof Truck }> = {
  WAITING: { label: 'Бэлтгэгдэж байна', tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: ChefHat },
  READY_FOR_DELIVERY: { label: 'Авахад бэлэн', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PackageCheck },
  PICKED_UP: { label: 'Захиалга авсан', tone: 'bg-blue-50 text-blue-700 border-blue-200', icon: PackageCheck },
  ON_THE_WAY: { label: 'Замд явж байна', tone: 'bg-violet-50 text-violet-700 border-violet-200', icon: Navigation },
  DELIVERED: { label: 'Хүргэгдсэн', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

export function DriverDashboard() {
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState<'mine' | 'available'>('available');
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['deliveries-mine'], queryFn: () => api<{ orders: Delivery[] }>('/deliveries/mine') });
  const available = useQuery({ queryKey: ['deliveries-available'], queryFn: () => api<{ orders: Delivery[] }>('/deliveries/available') });
  const act = useMutation({ mutationFn: async ({ path, body }: { path: string; body?: unknown }) => {
    if (body && navigator.geolocation) {
      const p = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }));
      body = { ...(body as object), latitude: p.coords.latitude, longitude: p.coords.longitude };
    }
    return api(path, { method: body ? 'PATCH' : 'POST', body });
  }, onSuccess: () => { toast.success('Хүргэлтийн төлөв шинэчлэгдлээ'); void qc.invalidateQueries({ queryKey: ['deliveries-mine'] }); void qc.invalidateQueries({ queryKey: ['deliveries-available'] }); }, onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Үйлдэл амжилтгүй') });
  const presence = useMutation({ mutationFn: (isOnline: boolean) => api('/locations/online', { method: 'PATCH', body: { isOnline } }), onSuccess: (_d, value) => { setOnline(value); toast.success(value ? 'Та онлайн боллоо' : 'Та офлайн боллоо'); } });

  useEffect(() => {
    if (!online || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((pos) => {
      const active = mine.data?.orders.find((o) => o.deliveryStatus !== 'DELIVERED');
      void api('/locations/ping', { method: 'POST', body: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, orderId: active?.id } });
    }, undefined, { enableHighAccuracy: true, maximumAge: 3000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [online, mine.data]);

  if (mine.isLoading || available.isLoading) return <DriverSkeleton />;
  const mineOrders = mine.data?.orders ?? [];
  const availableOrders = available.data?.orders ?? [];
  const activeMine = mineOrders.filter((o) => o.deliveryStatus !== 'DELIVERED');
  const completed = mineOrders.filter((o) => o.deliveryStatus === 'DELIVERED').length;
  const next: Record<string, [string, string]> = { READY_FOR_DELIVERY: ['PICKED_UP', 'Захиалгыг авлаа'], PICKED_UP: ['ON_THE_WAY', 'Хүргэлтэд гарах'], ON_THE_WAY: ['DELIVERED', 'Хүргэлтийг баталгаажуулах'] };
  const orders = tab === 'mine' ? activeMine : availableOrders;

  return <div className="mx-auto max-w-6xl space-y-7 pb-12">
    <header className="overflow-hidden border border-line bg-surface text-ink shadow-[0_16px_45px_rgba(25,24,22,0.05)]">
      <div className="relative px-6 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-14 -top-24 size-72 rounded-full border border-line" />
        <div className="pointer-events-none absolute -right-2 -top-12 size-40 rounded-full bg-paper" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] text-muted uppercase"><Truck size={14} /> Жолоочийн самбар</p><h1 className="mt-3 text-3xl tracking-[-0.04em] sm:text-4xl">Миний хүргэлтүүд</h1><p className="mt-2 text-sm text-muted">Захиалгаа авч, хүргэлтийн явцыг нэг дор удирдана.</p></div>
          <button onClick={() => presence.mutate(!online)} disabled={presence.isPending} className={`flex min-w-44 items-center justify-center gap-3 rounded-full border px-5 py-3 text-sm font-medium transition-all ${online ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-line-strong bg-paper text-muted hover:border-ink hover:text-ink'}`}>
            <span className={`relative flex size-2.5 ${online ? '' : 'opacity-60'}`}><span className={`absolute inline-flex size-full rounded-full ${online ? 'animate-ping bg-emerald-500 opacity-60' : 'bg-muted'}`} /><span className={`relative inline-flex size-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted'}`} /></span>{online ? 'ОНЛАЙН' : 'ОФЛАЙН'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-line bg-paper/60">
        <Stat value={activeMine.length} label="Идэвхтэй" /><Stat value={availableOrders.filter((o) => o.deliveryStatus === 'READY_FOR_DELIVERY').length} label="Авахад бэлэн" /><Stat value={completed} label="Хүргэсэн" />
      </div>
    </header>

    <div className="flex gap-1 border-b border-line">
      <Tab active={tab === 'available'} onClick={() => setTab('available')} icon={<Clock3 size={15} />} label="Хүлээгдэж буй" count={availableOrders.length} />
      <Tab active={tab === 'mine'} onClick={() => setTab('mine')} icon={<Truck size={15} />} label="Миний хүргэлт" count={activeMine.length} />
    </div>

    <AnimatePresence mode="wait"><motion.section key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .25 }}>
      {!orders.length ? <EmptyState icon={tab === 'mine' ? <Truck size={34} strokeWidth={1.3} /> : <Clock3 size={34} strokeWidth={1.3} />} title={tab === 'mine' ? 'Танд идэвхтэй хүргэлт алга' : 'Хүлээгдэж буй хүргэлт алга'} description={tab === 'mine' ? 'Бэлэн болсон хүргэлтийг хүлээгдэж буй жагсаалтаас аваарай.' : 'Шинэ захиалга орж ирэхэд энд автоматаар харагдана.'} /> : <div className="grid gap-5 lg:grid-cols-2">{orders.map((o, index) => {
        const step = next[o.deliveryStatus];
        return <DeliveryCard key={o.id} order={o} index={index} action={tab === 'mine' ? (step ? (code) => act.mutate({ path: `/deliveries/${o.id}/status`, body: { status: step[0], ...(code ? { code } : {}) } }) : undefined) : (o.deliveryStatus === 'READY_FOR_DELIVERY' ? () => act.mutate({ path: `/deliveries/${o.id}/claim` }) : undefined)} label={tab === 'mine' ? step?.[1] : (o.deliveryStatus === 'READY_FOR_DELIVERY' ? 'Хүргэлтийг авах' : undefined)} loading={act.isPending} />;
      })}</div>}
    </motion.section></AnimatePresence>
  </div>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="px-5 py-4 text-center first:border-r last:border-l first:border-line last:border-line sm:text-left"><div className="text-2xl tracking-[-0.04em]">{value}</div><div className="mt-0.5 text-[10px] tracking-[0.14em] text-muted uppercase">{label}</div></div>; }

function Tab({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) { return <button onClick={onClick} className={`relative flex items-center gap-2 px-4 py-3.5 text-sm transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}>{icon}<span>{label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-ink text-white' : 'bg-paper text-muted'}`}>{count}</span>{active && <motion.span layoutId="driver-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />}</button>; }

function DeliveryCard({ order: o, action, label, loading, index }: { order: Delivery; action?: (code?: string) => void; label?: string; loading?: boolean; index: number }) {
  const [code, setCode] = useState('');
  const hasPoint = o.deliveryLat != null && o.deliveryLng != null;
  const meta = DELIVERY_META[o.deliveryStatus] ?? DELIVERY_META.WAITING;
  const StatusIcon = meta.icon;
  return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .04, .2) }} className="group overflow-hidden border border-line bg-surface transition-shadow duration-300 hover:shadow-[0_18px_50px_rgba(25,24,22,0.07)]">
    {hasPoint && <div className="relative h-44 overflow-hidden bg-paper"><iframe title={`Захиалга ${o.orderNo} газрын зураг`} className="h-full w-full border-0 grayscale-[.25] transition-transform duration-500 group-hover:scale-[1.02]" src={`https://www.openstreetmap.org/export/embed.html?bbox=${o.deliveryLng!-0.012}%2C${o.deliveryLat!-0.012}%2C${o.deliveryLng!+0.012}%2C${o.deliveryLat!+0.012}&marker=${o.deliveryLat}%2C${o.deliveryLng}`} /><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLat},${o.deliveryLng}`} className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-white shadow-lg"><Navigation size={13} /> Маршрут <ExternalLink size={11} /></a></div>}
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-medium tracking-[0.16em] text-faint uppercase">Захиалга #{o.orderNo}</p><h3 className="mt-1 text-xl font-medium tracking-[-0.025em]">{o.customerName}</h3></div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-medium whitespace-nowrap ${meta.tone}`}><StatusIcon size={12} />{meta.label}</span></div>
      <div className="mt-5 space-y-4 border-y border-line py-4">
        <LocationRow icon={<Store size={16} />} eyebrow="Авах ресторан" title={o.tenant.name} detail={o.tenant.address ?? 'Хаяг бүртгэгдээгүй'} />
        <div className="ml-[7px] h-3 border-l border-dashed border-line-strong" />
        <LocationRow icon={<MapPin size={16} />} eyebrow="Хүргэх хаяг" title={o.district ?? 'Дүүрэг сонгоогүй'} detail={o.addressLine ?? 'Хаяг бүртгэгдээгүй'} accent />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2"><a href={`tel:${o.customerPhone}`} className="flex h-11 items-center justify-center gap-2 rounded-full border border-line text-[13px] font-medium transition-colors hover:border-ink"><Phone size={15} /> {o.customerPhone}</a>{hasPoint ? <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLat},${o.deliveryLng}`} className="flex h-11 items-center justify-center gap-2 rounded-full border border-line text-[13px] font-medium transition-colors hover:border-ink"><Navigation size={15} /> Чиглэл авах</a> : <span className="flex h-11 items-center justify-center gap-2 rounded-full border border-line text-[12px] text-faint"><MapPin size={14} /> Координатгүй</span>}</div>
      {o.deliveryStatus === 'ON_THE_WAY' && <div className="mt-5 bg-paper p-4"><label className="flex items-center gap-2 text-xs font-medium"><Radio size={14} /> Хүлээн авагчийн баталгаажуулах код</label><Input className="mt-3 bg-white text-center text-lg tracking-[0.45em]" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /><p className="mt-2 text-[11px] text-muted">Хэрэглэгчид харагдаж буй 6 оронтой кодыг оруулна.</p></div>}
      {action && <Button full size="lg" className="mt-5" loading={loading} disabled={o.deliveryStatus === 'ON_THE_WAY' && code.length !== 6} onClick={() => action(code)}>{label}<ArrowRight size={16} /></Button>}
      {!action && o.deliveryStatus === 'WAITING' && <div className="mt-5 flex items-center justify-center gap-2 rounded-full bg-paper px-4 py-3 text-xs font-medium text-muted"><ChefHat size={15} /> Хоол бэлэн болмогц авах боломжтой</div>}
    </div>
  </motion.article>;
}

function LocationRow({ icon, eyebrow, title, detail, accent }: { icon: React.ReactNode; eyebrow: string; title: string; detail: string; accent?: boolean }) { return <div className="flex gap-3"><div className={`grid size-8 shrink-0 place-items-center rounded-full ${accent ? 'bg-ink text-white' : 'bg-paper text-muted'}`}>{icon}</div><div className="min-w-0"><p className="text-[9px] font-medium tracking-[0.15em] text-faint uppercase">{eyebrow}</p><p className="mt-0.5 truncate text-sm font-medium">{title}</p><p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{detail}</p></div></div>; }

function DriverSkeleton() { return <div className="mx-auto max-w-6xl space-y-6"><Skeleton className="h-64" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-[430px]" /><Skeleton className="h-[430px]" /></div></div>; }
