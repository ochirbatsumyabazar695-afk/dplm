import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { time } from '../lib/format';
import type { RequestStatus, RestaurantRequest } from '../lib/types';
import { useAccount } from '../store/auth';
import { Button, Card, EmptyState, Input, Page, Skeleton } from '../components/ui';
import { cn } from '../lib/cn';

/** Платформын админ — рестораны хүсэлтүүдийг хянана. */
export function AdminRequests() {
  const queryClient = useQueryClient();
  const { account, ready, isSignedIn } = useAccount();
  const [filter, setFilter] = useState<RequestStatus | 'ALL'>('PENDING');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-requests', filter],
    queryFn: () =>
      api<{ requests: RestaurantRequest[] }>(`/restaurant-requests?status=${filter}`),
    enabled: ready && isSignedIn && !!account?.isPlatformAdmin,
    refetchInterval: 15000,
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      api<{ tenant: { name: string; slug: string } }>(`/restaurant-requests/${id}/approve`, {
        method: 'POST',
      }),
    onSuccess: ({ tenant }) => {
      toast.success(`${tenant.name} үүслээ`);
      void queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Зөвшөөрөхөд алдаа гарлаа'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote: string }) =>
      api(`/restaurant-requests/${id}/reject`, { method: 'POST', body: { reviewNote } }),
    onSuccess: () => {
      toast('Хүсэлтийг татгалзлаа');
      void queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Татгалзахад алдаа гарлаа'),
  });

  if (!ready) {
    return (
      <Page className="mx-auto max-w-3xl px-5 pt-12">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-32" />
      </Page>
    );
  }

  // Платформын админ биш бол энэ хуудас байхгүй мэт.
  if (!isSignedIn || !account?.isPlatformAdmin) return <Navigate to="/" replace />;

  const requests = data?.requests ?? [];

  return (
    <Page className="mx-auto max-w-3xl px-5 pt-12 sm:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Masteurent
      </Link>

      <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">Рестораны хүсэлтүүд</h1>
      <p className="mt-1 text-muted">Платформын админ — {account.email}</p>

      <div className="mt-7 flex flex-wrap gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-4 py-2 text-[13px] transition-colors',
              filter === f
                ? 'border-ink bg-ink text-bg'
                : 'border-line text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {LABEL[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !requests.length ? (
        <EmptyState
          title="Хүсэлт алга"
          description={filter === 'PENDING' ? 'Хянагдах хүсэлт байхгүй байна.' : 'Энэ ангилалд хүсэлт алга.'}
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <RequestRow
                request={r}
                busy={approve.isPending || reject.isPending}
                onApprove={() => approve.mutate(r.id)}
                onReject={(note) => reject.mutate({ id: r.id, reviewNote: note })}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

const LABEL: Record<RequestStatus | 'ALL', string> = {
  PENDING: 'Хянагдаж буй',
  APPROVED: 'Зөвшөөрсөн',
  REJECTED: 'Татгалзсан',
  ALL: 'Бүгд',
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  PENDING: 'bg-black/[0.05] text-muted',
  APPROVED: 'bg-ok/10 text-ok',
  REJECTED: 'bg-bad/10 text-bad',
};

function RequestRow({
  request,
  busy,
  onApprove,
  onReject,
}: {
  request: RestaurantRequest;
  busy: boolean;
  onApprove: () => void;
  onReject: (note: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="size-4 shrink-0 rounded-[5px]"
              style={{ backgroundColor: request.accentColor }}
            />
            <p className="text-[16px] font-medium">{request.name}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px]', STATUS_STYLE[request.status])}>
              {LABEL[request.status]}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            /t/{request.slug} · {time(request.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13.5px]">
        {request.account && (
          <Row label="Хүсэлт гаргагч" value={`${request.account.name} · ${request.account.email}`} />
        )}
        {request.tagline && <Row label="Тайлбар" value={request.tagline} />}
        {request.phone && <Row label="Утас" value={request.phone} />}
        {request.address && <Row label="Хаяг" value={request.address} />}
        {request.note && <Row label="Тэмдэглэл" value={request.note} />}
        {request.reviewNote && <Row label="Админы хариу" value={request.reviewNote} />}
      </div>

      {request.status === 'PENDING' && (
        <div className="mt-5 border-t border-line pt-4">
          {rejecting ? (
            <div className="space-y-3">
              <Input
                autoFocus
                placeholder="Татгалзсан шалтгаан..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => {
                    if (note.trim().length < 3) {
                      toast.error('Шалтгаанаа бичнэ үү');
                      return;
                    }
                    onReject(note.trim());
                  }}
                >
                  Татгалзахыг батлах
                </Button>
                <Button variant="secondary" onClick={() => setRejecting(false)}>
                  Болих
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button loading={busy} onClick={onApprove}>
                <Check size={16} />
                Зөвшөөрөх
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(true)}>
                <X size={16} />
                Татгалзах
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
