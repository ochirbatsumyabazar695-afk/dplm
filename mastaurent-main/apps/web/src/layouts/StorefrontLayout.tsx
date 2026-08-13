import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, ReceiptText, ShoppingBag, User, UtensilsCrossed } from 'lucide-react';
import { api, setActiveTenant } from '../lib/api';
import type { Tenant } from '../lib/types';
import { cartTotals, useCartLines } from '../store/cart';
import { mnt } from '../lib/format';
import { CapsuleNav } from '../components/CapsuleNav';
import { CartSheet } from '../components/CartSheet';
import { Skeleton } from '../components/ui';

const TenantContext = createContext<Tenant | null>(null);

export const useTenant = () => {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error('useTenant-ийг StorefrontLayout дотор ашиглана');
  return tenant;
};

export function StorefrontLayout() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const lines = useCartLines(slug);
  const { count, subtotal } = cartTotals(lines);

  // Render-ийн үед тавина, useEffect дотор БИШ. Хүүхэд компонентын эффект
  // (жишээ нь ItemDetail-ийн query) эцгийн эффектээс өмнө ажилладаг тул
  // useEffect дотор тавихад эхний хүсэлт X-Tenant-гүй явдаг байв.
  if (slug) setActiveTenant(slug);

  useEffect(() => () => setActiveTenant(null), []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenant', slug],
    queryFn: () => api<{ tenant: Tenant }>(`/tenants/${slug}`),
    enabled: !!slug,
  });

  const tenant = data?.tenant;

  // Рестораны brand өнгийг бүх UI рүү шахна.
  useEffect(() => {
    if (!tenant) return;
    document.documentElement.style.setProperty('--accent', tenant.accentColor);
    document.documentElement.style.setProperty('--accent-soft', `${tenant.accentColor}1f`);
    document.title = `${tenant.name} — хүргэлт`;
    return () => {
      document.documentElement.style.setProperty('--accent', '#0a0a0a');
      document.documentElement.style.setProperty('--accent-soft', '#0a0a0a14');
    };
  }, [tenant]);

  if (isLoading) return <StorefrontSkeleton />;

  if (isError || !tenant) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="label">Алдаа 404</p>
          <h1 className="mt-4 text-[clamp(28px,5vw,48px)] tracking-[-0.04em]">Ресторан олдсонгүй</h1>
          <p className="mt-2 text-muted">Хаяг буруу эсвэл ресторан хаагдсан байна.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-7 rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-bg transition-opacity hover:opacity-85"
          >
            Нүүр хуудас руу
          </button>
        </div>
      </div>
    );
  }

  const base = `/t/${slug}`;
  const navItems = [
    { to: base, label: 'Нүүр', icon: Home, end: true },
    { to: `${base}/menu`, label: 'Цэс', icon: UtensilsCrossed },
    { to: `${base}/orders`, label: 'Захиалга', icon: ReceiptText },
    { to: `${base}/profile`, label: 'Профайл', icon: User },
  ];

  return (
    <TenantContext.Provider value={tenant}>
      <div className="min-h-dvh pb-32">
        <Outlet />
      </div>

      <CapsuleNav
        items={navItems}
        right={
          <AnimatePresence>
            {count > 0 && (
              <motion.button
                initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                animate={{ width: 'auto', opacity: 1, marginLeft: 6 }}
                exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => setCartOpen(true)}
                className="flex items-center gap-2 overflow-hidden rounded-full bg-ink px-3.5 py-2 text-[13px] font-medium text-white whitespace-nowrap"
              >
                <ShoppingBag size={16} strokeWidth={2} />
                <motion.span key={count} initial={{ scale: 1.25 }} animate={{ scale: 1 }}>
                  {count}
                </motion.span>
                <span className="opacity-50">·</span>
                <span>{mnt(subtotal)}</span>
              </motion.button>
            )}
          </AnimatePresence>
        }
      />

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </TenantContext.Provider>
  );
}

function StorefrontSkeleton() {
  return (
    <div className="min-h-dvh">
      <Skeleton className="h-56 w-full rounded-none" />
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-6">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    </div>
  );
}
