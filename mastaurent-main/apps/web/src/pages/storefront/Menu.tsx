import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, UtensilsCrossed, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { Category } from '../../lib/types';
import { useTenant } from '../../layouts/StorefrontLayout';
import { DishCard } from '../../components/DishCard';
import { EmptyState, Page, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';

export function StorefrontMenu() {
  const tenant = useTenant();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const tableToken = params.get('table');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['menu', tenant.slug],
    queryFn: () => api<{ categories: Category[] }>('/menu'),
  });

  const tableQuery = useQuery({
    queryKey: ['table-qr', tenant.slug, tableToken],
    queryFn: () => api<{ table: { id: string; number: string } }>(`/tables/qr/${tableToken}`),
    enabled: !!tableToken,
    retry: false,
  });

  useEffect(() => {
    if (tableToken && tableQuery.data?.table) sessionStorage.setItem(`hool_table_${tenant.slug}`, tableToken);
  }, [tableToken, tableQuery.data, tenant.slug]);

  const categories = data?.categories ?? [];
  const activeId = params.get('c') ?? categories[0]?.id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        menuItems: c.menuItems.filter(
          (i) =>
            i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.menuItems.length > 0);
  }, [categories, query]);

  // Ангилал сонгоход тухайн хэсэг рүү зөөлөн гүйлгэнэ.
  useEffect(() => {
    if (!activeId || query) return;
    const el = sectionRefs.current[activeId];
    if (el) window.scrollTo({ top: el.offsetTop - 150, behavior: 'smooth' });
  }, [activeId, query]);

  return (
    <Page className="mx-auto max-w-[1400px] px-6 pt-14 lg:px-10">
      <p className="label">{tenant.name}</p>
      {tableQuery.data?.table && <p className="mt-3 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">{tableQuery.data.table.number} — ширээнээс захиалж байна</p>}
      {tableToken && tableQuery.isError && <p className="mt-3 text-sm text-bad">QR код хүчингүй байна. Ажилтнаас лавлана уу.</p>}
      <h1 className="display mt-5 text-[clamp(38px,7vw,96px)]">Цэс</h1>

      {/* Хайлт */}
      <div className="rule relative mt-12">
        <Search size={16} className="absolute top-1/2 left-0 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Хоол хайх"
          className="h-14 w-full bg-transparent pr-10 pl-8 text-[clamp(16px,2vw,22px)] tracking-[-0.02em] outline-none placeholder:text-faint"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Цэвэрлэх"
            className="absolute top-1/2 right-0 grid size-8 -translate-y-1/2 place-items-center rounded-full text-faint transition-colors hover:text-ink"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Ангиллын capsule таб */}
      {!query && categories.length > 0 && (
        <div className="sticky top-0 z-20 -mx-6 mt-4 bg-bg/85 px-6 py-4 backdrop-blur-md lg:-mx-10 lg:px-10">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {categories.map((c) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => setParams({ c: c.id }, { replace: true })}
                  className={cn(
                    'relative shrink-0 rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors',
                    active
                      ? 'border-transparent text-white'
                      : 'border-line bg-surface text-muted hover:text-ink',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="cat-pill"
                      className="absolute inset-0 rounded-full bg-accent"
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 py-8 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={30} strokeWidth={1.5} />}
          title="Хайлтад тохирох хоол алга"
          description="Өөр түлхүүр үгээр хайж үзнэ үү."
        />
      ) : (
        <div className="space-y-20 py-12 lg:space-y-28">
          {filtered.map((c, ci) => (
            <section
              key={c.id}
              ref={(el) => {
                sectionRefs.current[c.id] = el;
              }}
            >
              <div className="rule mb-10 flex items-baseline gap-5 pt-5">
                <span className="label numeral">{String(ci + 1).padStart(2, '0')}</span>
                <h2 className="text-[clamp(22px,3vw,40px)] tracking-[-0.04em]">{c.name}</h2>
                <span className="label ml-auto">{c.menuItems.length}</span>
              </div>
              <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {c.menuItems.map((item, i) => (
                  <DishCard key={item.id} item={item} index={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
