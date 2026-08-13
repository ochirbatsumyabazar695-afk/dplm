import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, LayoutDashboard, LogOut, Phone, ShieldCheck, Store, UserRound } from 'lucide-react';
import { useMember, useSignOut, isStaff } from '../../store/auth';
import { useTenant } from '../../layouts/StorefrontLayout';
import { Button, Card, EmptyState, Page, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';

export function Profile() {
  const { slug = '' } = useParams();
  const tenant = useTenant();
  const navigate = useNavigate();
  const { user, ready } = useMember(slug);
  const signOut = useSignOut();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const save = useMutation({
    mutationFn: () => api('/auth/me', { method: 'PATCH', body: { name, phone } }),
    onSuccess: () => { setEditing(false); void qc.invalidateQueries({ queryKey: ['membership'] }); void qc.invalidateQueries({ queryKey: ['account'] }); },
  });

  // Гишүүнчлэл ачаалагдаж дуустал "нэвтрээгүй" гэж БҮҮ хэл — нэвтэрсэн
  // хүнд эхлээд буруу мессеж анивчихаас сэргийлнэ.
  if (!ready) {
    return (
      <Page className="mx-auto max-w-lg px-5 pt-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Профайл</h1>
        <Skeleton className="mt-6 h-28" />
      </Page>
    );
  }

  if (!user) {
    return (
      <Page className="mx-auto max-w-lg px-5 pt-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Профайл</h1>
        <EmptyState
          icon={<UserRound size={30} strokeWidth={1.5} />}
          title="Та нэвтрээгүй байна"
          description="Нэвтэрснээр захиалгын түүх, хаягаа хадгална."
          action={
            <div className="flex gap-2">
              <Button onClick={() => navigate(`/t/${slug}/login`)}>Нэвтрэх</Button>
              <Button variant="secondary" onClick={() => navigate(`/t/${slug}/register`)}>
                Бүртгүүлэх
              </Button>
            </div>
          }
        />
      </Page>
    );
  }

  return (
    <Page className="mx-auto max-w-lg px-5 pt-8">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Профайл</h1>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-[20px] font-semibold text-white">
            {user.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{user.name}</p>
            <p className="truncate text-[13.5px] text-muted">{user.email}</p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 border-t border-line pt-5 text-[14px]">
          <Row icon={<Phone size={15} />} label="Утас" value={user.phone ?? '—'} />
          <Row icon={<Store size={15} />} label="Ресторан" value={tenant.name} />
          <Row
            icon={<ShieldCheck size={15} />}
            label="Эрх"
            value={user.role === 'USER' ? 'Харилцагч' : 'Ажилтан'}
          />
        </div>
      </Card>

      {editing ? <form className="mt-4 space-y-3 border border-line p-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <input className="w-full border border-line bg-bg p-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="Нэр" required />
        <input className="w-full border border-line bg-bg p-3" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Утас" required />
        <div className="flex gap-2"><Button type="submit" loading={save.isPending}>Хадгалах</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Болих</Button></div>
      </form> : <Button variant="secondary" full className="mt-4" onClick={() => { setName(user.name); setPhone(user.phone ?? ''); setEditing(true); }}>Профайл засах</Button>}

      {isStaff(user) && (
        <Link to="/dashboard/orders" className="mt-4 block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-strong">
            <LayoutDashboard size={18} className="text-accent" />
            <div className="flex-1">
              <p className="text-[14.5px] font-medium">Удирдлагын самбар</p>
              <p className="text-[13px] text-muted">Захиалга, цэс удирдах</p>
            </div>
          </Card>
        </Link>
      )}

      {user.role === 'USER' && (
        <Link to="/restaurant-request" className="mt-4 block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-strong">
            <Building2 size={18} className="text-accent" />
            <div className="flex-1">
              <p className="text-[14.5px] font-medium">Ресторан бүртгүүлэх</p>
              <p className="text-[13px] text-muted">Шинэ ресторан нээх хүсэлт илгээх, төлвийг хянах</p>
            </div>
          </Card>
        </Link>
      )}

      <Button
        variant="secondary"
        full
        className="mt-4"
        onClick={() => void signOut({ redirectUrl: `/t/${slug}` })}
      >
        <LogOut size={16} />
        Гарах
      </Button>
    </Page>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-muted">
        {icon}
        {label}
      </span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
