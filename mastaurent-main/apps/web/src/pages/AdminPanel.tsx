import { Link, NavLink, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { useAccount } from '../store/auth';
import { Button, Card, EmptyState, Page, Skeleton, SmartImage } from '../components/ui';
import { cn } from '../lib/cn';

/** Платформын админы хуудсуудын нийтлэг хүрээ. */
export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { account, ready, isSignedIn } = useAccount();

  // AdminRequests-тэй ижил хамгаалалт. Сервер тал `requirePlatformAdmin`-аар
  // хаалттай тул өгөгдөл алдагдахгүй ч, эрхгүй хүнд админы бүрхүүл
  // харагдаад хоосон жагсаалт үзүүлэх нь эвгүй.
  if (!ready) {
    return (
      <Page className="mx-auto max-w-4xl px-5 pt-12 sm:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-32" />
      </Page>
    );
  }

  if (!isSignedIn || !account?.isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <Page className="mx-auto max-w-4xl px-5 pt-12 sm:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Masteurent
      </Link>

      <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-1 text-muted">{subtitle ?? `Платформын админ — ${account?.email ?? ''}`}</p>

      <nav className="mt-7 flex flex-wrap gap-2">
        {[
          { to: '/admin/requests', label: 'Хүсэлтүүд' },
          { to: '/admin/tenants', label: 'Ресторанууд' },
          { to: '/admin/accounts', label: 'Хэрэглэгчид' },
        ].map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                'rounded-full border px-4 py-2 text-[13px] transition-colors',
                isActive
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line text-muted hover:border-line-strong hover:text-ink',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {children}
    </Page>
  );
}

type AdminTenant = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  logoUrl: string | null;
  isActive: boolean;
  _count: { menuItems: number; orders: number; users: number };
  users: { name: string; email: string }[];
};

/** Бүх ресторан — идэвхжүүлэх/идэвхгүй болгох. */
export function AdminTenants() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => api<{ tenants: AdminTenant[] }>('/admin/tenants'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/admin/tenants/${id}/active`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => {
      toast.success('Шинэчлэгдлээ');
      void queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Алдаа гарлаа'),
  });

  const tenants = data?.tenants ?? [];

  return (
    <AdminShell title="Ресторанууд">
      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !tenants.length ? (
        <EmptyState title="Ресторан алга" description="Одоогоор бүртгэгдсэн ресторан байхгүй." />
      ) : (
        <ul className="mt-6 space-y-3">
          {tenants.map((t) => (
            <li key={t.id}>
              <Card className="flex flex-wrap items-center gap-4 p-5">
                <SmartImage
                  src={t.logoUrl}
                  alt={t.name}
                  eager
                  className="size-11 shrink-0 rounded-[11px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="text-[15px] font-medium">{t.name}</p>
                    {!t.isActive && (
                      <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[11px] text-bad">
                        идэвхгүй
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    /t/{t.slug}
                    {t.category ? ` · ${t.category}` : ''} · эзэн: {t.users[0]?.name ?? '—'}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-faint">
                    {t._count.menuItems} хоол · {t._count.orders} захиалга · {t._count.users} гишүүн
                  </p>
                </div>
                <Button
                  variant="secondary"
                  loading={toggle.isPending}
                  onClick={() => toggle.mutate({ id: t.id, isActive: !t.isActive })}
                >
                  {t.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

type AdminAccount = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  isBlocked: boolean;
  createdAt: string;
  memberships: { role: string; tenant: { id: string; name: string; slug: string } }[];
};

/** Бүх хэрэглэгч — аль ресторанд ямар эрхтэйг нь хамт. */
export function AdminAccounts() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: () => api<{ accounts: AdminAccount[] }>('/admin/accounts'),
  });

  const accounts = data?.accounts ?? [];
  const block = useMutation({
    mutationFn: ({ id, isBlocked }: { id: string; isBlocked: boolean }) => api(`/admin/accounts/${id}/block`, { method: 'PATCH', body: { isBlocked } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-accounts'] }),
  });

  return (
    <AdminShell title="Хэрэглэгчид" subtitle={`${accounts.length} бүртгэл`}>
      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {accounts.map((a) => (
            <li key={a.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-[15px] font-medium">{a.name}</p>
                      {a.isPlatformAdmin && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {a.email}
                      {a.phone ? ` · ${a.phone}` : ''}
                    </p>
                  </div>
                  <span className="text-[12.5px] text-faint">
                    {new Date(a.createdAt).toLocaleDateString('mn-MN')}
                  </span>
                  {!a.isPlatformAdmin && <Button size="sm" variant={a.isBlocked ? 'secondary' : 'danger'} onClick={() => block.mutate({ id: a.id, isBlocked: !a.isBlocked })}>{a.isBlocked ? 'Block цуцлах' : 'Block хийх'}</Button>}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {a.memberships.length === 0 ? (
                    <span className="text-[12.5px] text-faint">USER — ресторанд эрхгүй</span>
                  ) : (
                    a.memberships.map((m) => (
                      <span
                        key={m.tenant.id}
                        className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[12px] text-muted"
                      >
                        {m.role} · {m.tenant.name}
                      </span>
                    ))
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
