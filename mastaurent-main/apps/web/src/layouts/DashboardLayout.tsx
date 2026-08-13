import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Grid2x2, LogOut, Settings, UtensilsCrossed } from 'lucide-react';
import { api, setActiveTenant } from '../lib/api';
import type { Role, Tenant } from '../lib/types';
import { isStaff, useSignOut, useStaffMember } from '../store/auth';
import { CapsuleNav } from '../components/CapsuleNav';
import { Skeleton } from '../components/ui';

export function DashboardLayout({ roles, base = '/dashboard' }: { roles?: Role[]; base?: string }) {
  const { user, isSignedIn, ready } = useStaffMember();
  const signOut = useSignOut();

  const { data } = useQuery({
    queryKey: ['dash-tenant', user?.tenantId],
    queryFn: () => api<{ tenant: Tenant }>('/tenants/me'),
    enabled: !!user,
    select: (d) => d.tenant,
  });

  // Ажилтны tenant-ыг бүх хүсэлтэд наана + brand өнгийг тохируулна.
  //
  // Самбараас гармагц буцааж цэвэрлэнэ — StorefrontLayout ч мөн адил хийдэг.
  // Цэвэрлэхгүй бол ажилтны ресторан наалдаад үлдэж, дараа нь өөр ресторан
  // руу зочноор орход хүсэлтүүд буруу tenant рүү явна.
  useEffect(() => {
    if (!data) return;
    setActiveTenant(data.slug);
    document.documentElement.style.setProperty('--accent', data.accentColor);
    document.documentElement.style.setProperty('--accent-soft', `${data.accentColor}1f`);
    document.title = `${data.name} — самбар`;
  }, [data]);

  useEffect(() => () => setActiveTenant(null), []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-5 pt-28">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/" replace />;
  if (!isStaff(user) && !user.isPlatformAdmin) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;


  const items = user.role === 'KITCHEN'
    ? [{ to: `${base}/orders`, label: 'Гал тогоо', icon: ClipboardList }]
    : user.role === 'DRIVER'
      ? [{ to: `${base}/deliveries`, label: 'Хүргэлт', icon: ClipboardList }]
      : user.role === 'CASHIER'
        ? [{ to: `${base}/orders`, label: 'Захиалга, касс', icon: ClipboardList }]
      : [
          { to: `${base}/orders`, label: 'Захиалга', icon: ClipboardList },
          { to: `${base}/menu`, label: 'Цэс', icon: UtensilsCrossed },
          { to: `${base}/tables`, label: 'Танхим', icon: Grid2x2 },
          { to: `${base}/reservations`, label: 'Ширээ', icon: CalendarDays },
          { to: `${base}/dispatch`, label: 'Хүргэлт', icon: ClipboardList },
          ...(user.role === 'DIRECTOR' ? [{ to: `${base}/staff`, label: 'Ажилтан', icon: ClipboardList }] : []),
          ...(user.role === 'DIRECTOR' ? [{ to: `${base}/settings`, label: 'Тохиргоо', icon: Settings }] : []),
        ];

  return (
    <div className="min-h-dvh pt-24 pb-16">
      <CapsuleNav
        position="top"
        items={items}
        right={
          <button
            onClick={() => void signOut({ redirectUrl: '/dashboard/login' })}
            aria-label="Гарах"
            className="ml-1 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            <LogOut size={16} />
          </button>
        }
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Outlet context={data} />
      </div>
    </div>
  );
}

function homeFor(role: Role) {
  if (role === 'DIRECTOR') return '/director/orders';
  if (role === 'MANAGER') return '/manager/orders';
  if (role === 'CASHIER') return '/cashier/orders';
  if (role === 'KITCHEN') return '/kitchen/orders';
  if (role === 'DRIVER') return '/driver/deliveries';
  return '/';
}
