import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, api } from '../../lib/api';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import type { Role } from '../../lib/types';

type Staff = { id: string; name: string; email: string; phone: string | null; role: Role; isActive: boolean };

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function StaffManagement() {
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'CASHIER' | 'KITCHEN' | 'DRIVER'>('KITCHEN');
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['staff'], queryFn: () => api<{ staff: Staff[] }>('/staff') });

  const save = useMutation({
    mutationFn: (body: unknown) => api('/staff', { method: 'POST', body }),
    onSuccess: () => {
      setIdentifier('');
      toast.success('Ажилтан нэмэгдлээ');
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
    // Өмнө нь алдааг чимээгүй залгидаг байсан — маягт зүгээр л юу ч
    // болоогүй мэт зогсдог байв.
    onError: (e) => toast.error(message(e, 'Ажилтан нэмэхэд алдаа гарлаа')),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api(`/staff/${id}`, { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff'] }),
    onError: (e) => toast.error(message(e, 'Өөрчлөхөд алдаа гарлаа')),
  });

  if (q.isLoading) return <Skeleton className="h-72" />;

  // 403 = энэ дансанд ажилтны эрх алга. Хоосон жагсаалт үзүүлэхийн оронд
  // яагаад гэдгийг нь хэлнэ — эс бол хуудас эвдэрсэн мэт харагдана.
  if (q.isError) {
    return (
      <EmptyState
        title="Ажилтны жагсаалтыг харах боломжгүй"
        description={message(q.error, 'Дахин оролдоно уу.')}
      />
    );
  }

  const staff = q.data?.staff ?? [];

  return (
    <div className="space-y-7">
      <header>
        <p className="label">Захирал</p>
        <h1 className="mt-2 text-3xl">Ажилтны удирдлага</h1>
      </header>

      <form
        className="grid gap-3 border border-line bg-paper p-5 sm:grid-cols-[1fr_180px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ identifier, role });
        }}
      >
        <label className="label">
          Утасны дугаар эсвэл и-мэйл
          <Input
            className="mt-2"
            placeholder="88746068"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <span className="mt-1 block text-[11px] font-normal normal-case text-muted">
            Тэр хүн эхлээд утсаараа нэг удаа нэвтэрсэн байх ёстой.
          </span>
        </label>
        <label className="label">
          Эрх
          <select
            className="mt-2 w-full border border-line bg-bg p-3"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option>MANAGER</option>
            <option>CASHIER</option>
            <option>KITCHEN</option>
            <option>DRIVER</option>
          </select>
        </label>
        <Button className="self-end" type="submit" loading={save.isPending}>
          Нэмэх
        </Button>
      </form>

      {!staff.length ? (
        <EmptyState
          title="Ажилтан алга"
          description="Дээрх маягтаар эхний ажилтнаа нэмнэ үү."
        />
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-line p-4"
            >
              <div>
                <strong>{s.name}</strong>
                <p className="text-sm text-muted">
                  {s.phone ?? s.email} · {s.role}
                  {!s.isActive && ' · идэвхгүй'}
                </p>
              </div>
              {s.role !== 'DIRECTOR' && (
                <Button
                  variant="ghost"
                  onClick={() => patch.mutate({ id: s.id, body: { isActive: !s.isActive } })}
                >
                  {s.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
