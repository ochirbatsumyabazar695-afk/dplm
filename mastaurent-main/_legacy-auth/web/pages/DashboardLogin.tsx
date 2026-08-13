import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../../lib/api';
import type { TenantCard } from '../../lib/types';
import { isStaff, useAuth } from '../../store/auth';
import { Button, Field, Input, Page, Select } from '../../components/ui';

export function DashboardLogin() {
  const navigate = useNavigate();
  const { user, ready, login } = useAuth();
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api<{ tenants: TenantCard[] }>('/tenants'),
  });

  const tenants = data?.tenants ?? [];

  useEffect(() => {
    if (!slug && tenants.length) setSlug(tenants[0].slug);
  }, [tenants, slug]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', '#0a0a0a');
    document.title = 'Ресторан нэвтрэх';
  }, []);

  if (ready && user && isStaff(user)) return <Navigate to="/dashboard/orders" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(slug, email, password);
      if (!isStaff(u)) {
        toast.error('Энэ бүртгэл удирдлагын эрхгүй байна');
        return;
      }
      toast.success('Тавтай морил');
      navigate('/dashboard/orders');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Нэвтрэхэд алдаа гарлаа');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page className="mx-auto max-w-sm px-5 pt-16">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Нүүр
      </Link>

      <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">Удирдлагын самбар</h1>
      <p className="mt-1 mb-7 text-muted">Рестораны ажилтны нэвтрэх хэсэг.</p>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Ресторан">
          <Select value={slug} onChange={(e) => setSlug(e.target.value)}>
            {tenants.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="И-мэйл">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@hool.mn"
            required
          />
        </Field>
        <Field label="Нууц үг">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </Field>

        <Button type="submit" full size="lg" loading={busy}>
          Нэвтрэх
        </Button>
      </form>

      {/* Демо түргэн нэвтрэх */}
      <div className="mt-6 rounded-[12px] border border-dashed border-line p-4">
        <p className="text-[12px] font-medium tracking-[0.03em] text-faint uppercase">
          Демо бүртгэлүүд
        </p>
        <div className="mt-2.5 space-y-1.5">
          {tenants.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSlug(t.slug);
                setEmail(demoEmail(t.slug));
                setPassword('123456');
              }}
              className="flex w-full items-center justify-between rounded-[9px] px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-black/[0.04]"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-muted">{demoEmail(t.slug)}</span>
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}

const demoEmail = (slug: string) =>
  ({
    'huslen-buuz': 'huslen@hool.mn',
    'sakura-sushi': 'sakura@hool.mn',
    'modun-burger': 'modun@hool.mn',
  })[slug] ?? 'owner@hool.mn';
