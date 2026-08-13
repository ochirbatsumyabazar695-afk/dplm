import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Store } from 'lucide-react';
import { api } from '../../lib/api';
import { mnt } from '../../lib/format';
import type { Category } from '../../lib/types';
import { useTenant } from '../../layouts/StorefrontLayout';
import { Page, Skeleton, SmartImage } from '../../components/ui';
import { CurtainReveal, MaskLines, MaskLinesInView, Parallax, Reveal } from '../../components/motion';
import { DishCard } from '../../components/DishCard';

export function StorefrontHome() {
  const tenant = useTenant();
  const { slug = '' } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['menu', slug],
    queryFn: () => api<{ categories: Category[] }>('/menu'),
  });

  const popular = data?.categories.flatMap((c) => c.menuItems).filter((i) => i.isPopular) ?? [];

  return (
    <Page>
      {/* Толгой */}
      <header className="mx-auto max-w-[1400px] px-6 pt-10 lg:px-10">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 text-[12.5px] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Masteurent
        </Link>

        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-6 flex items-center gap-3">
              <SmartImage
                src={tenant.logoUrl}
                alt={tenant.name}
                eager
                className="size-12 shrink-0 rounded-[12px]"
              />
              <p className="label">Ресторан — {tenant.slug}</p>
            </div>
            <h1 className="display text-[clamp(40px,7.5vw,110px)]">
              <MaskLines lines={[tenant.name]} delay={0.1} />
            </h1>
          </div>

          <div className="flex items-end lg:col-span-4">
            <p className="max-w-xs text-[15px] leading-relaxed text-muted">{tenant.tagline}</p>
          </div>
        </div>
      </header>

      {/* Ковер */}
      <CurtainReveal immediate delay={0.2} className="mt-12 px-6 lg:px-10">
        <div className="mx-auto max-w-[1400px]">
          <Parallax distance={40} className="h-[46vh] min-h-72 lg:h-[62vh]">
            <SmartImage
              src={tenant.coverUrl}
              alt={tenant.name}
              eager
              className="size-full scale-110"
            />
          </Parallax>
        </div>
      </CurtainReveal>

      {/* Ширээ захиалах */}
      <section className="mx-auto mt-12 max-w-[1400px] px-6 lg:px-10">
        <Link
          to={`/t/${slug}/reserve`}
          className="group flex items-center justify-between gap-4 rounded-[14px] border border-line px-6 py-5 transition-colors hover:border-line-strong"
        >
          <span>
            <span className="label block">Ширээ захиалах</span>
            <span className="mt-1.5 block text-[15px]">Урьдчилан ширээгээ авах</span>
          </span>
          <ArrowUpRight
            size={18}
            className="shrink-0 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
          />
        </Link>
      </section>

      {/* Мэдээллийн шугам */}
      {/* Хүргэлтгүй бол хэрэглэгчид эрт, тодорхой хэлнэ. */}
      {!tenant.deliveryEnabled && (
        <section className="mx-auto mt-12 max-w-[1400px] px-6 lg:px-10">
          <div className="rule flex items-start gap-3 pt-8">
            <Store size={18} className="mt-0.5 shrink-0 text-muted" />
            <p className="text-[15px] leading-relaxed">
              <span className="font-medium">Энэ ресторан хүргэлтийн үйлчилгээ үзүүлдэггүй.</span>{' '}
              <span className="text-muted">
                Захиалгаа {tenant.address ?? 'ресторанаас'} өөрөө авна.
              </span>
            </p>
          </div>
        </section>
      )}

      <section className="mx-auto mt-14 max-w-[1400px] px-6 lg:px-10">
        <div className="rule grid grid-cols-2 gap-y-8 pt-8 lg:grid-cols-4">
          <Meta
            label={tenant.deliveryEnabled ? 'Хүргэх хугацаа' : 'Бэлтгэх хугацаа'}
            value={`${tenant.etaMinutes} мин`}
          />
          <Meta
            label="Хүргэлтийн төлбөр"
            value={tenant.deliveryEnabled ? mnt(tenant.deliveryFee) : 'хүргэлтгүй'}
          />
          <Meta label="Хамгийн бага дүн" value={mnt(tenant.minOrder)} />
          <Meta label="Ажиллах цаг" value={`${tenant.openTime}—${tenant.closeTime}`} />
        </div>

        {tenant.description && (
          <Reveal>
            <p className="mt-14 max-w-2xl text-[clamp(17px,2vw,24px)] leading-[1.45] tracking-[-0.02em]">
              {tenant.description}
            </p>
          </Reveal>
        )}
      </section>

      {/* Онцлох хоол */}
      {isLoading ? (
        <div className="mx-auto mt-24 grid max-w-[1400px] gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3 lg:px-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : popular.length > 0 ? (
        <section className="mx-auto mt-28 max-w-[1400px] px-6 lg:mt-40 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <Reveal>
                <p className="label">01 — Онцлох</p>
              </Reveal>
            </div>
            <div className="flex items-end justify-between gap-6 lg:col-span-9">
              <h2 className="text-[clamp(26px,4vw,54px)] leading-[1.02] tracking-[-0.04em]">
                <MaskLinesInView lines={['Хамгийн эрэлттэй']} />
              </h2>
              <Link
                to={`/t/${slug}/menu`}
                className="group hidden shrink-0 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink sm:flex"
              >
                Бүх цэс
                <ArrowUpRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((item, i) => (
              <DishCard key={item.id} item={item} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Ангиллууд */}
      <section className="mx-auto mt-28 max-w-[1400px] px-6 lg:mt-40 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Reveal>
              <p className="label">02 — Цэс</p>
            </Reveal>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-[clamp(26px,4vw,54px)] leading-[1.02] tracking-[-0.04em]">
              <MaskLinesInView lines={['Ангиллууд']} />
            </h2>
          </div>
        </div>

        <div className="mt-12">
          {data?.categories.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <Link
                to={`/t/${slug}/menu?c=${c.id}`}
                className="rule group grid grid-cols-12 items-baseline gap-4 py-6"
              >
                <span className="label numeral col-span-2 lg:col-span-1">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="col-span-7 text-[clamp(19px,2.4vw,32px)] tracking-[-0.035em] transition-transform duration-500 group-hover:translate-x-3 lg:col-span-8">
                  {c.name}
                </h3>
                <span className="label numeral col-span-2 text-right lg:col-span-2">
                  {c.menuItems.length} хоол
                </span>
                <ArrowUpRight
                  size={17}
                  className="col-span-1 justify-self-end transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
                />
              </Link>
            </Reveal>
          ))}
          <div className="rule" />
        </div>
      </section>

      {/* Холбоо барих */}
      <section className="mx-auto mt-28 max-w-[1400px] px-6 pb-16 lg:px-10">
        <div className="rule grid gap-8 pt-8 sm:grid-cols-2">
          {tenant.address && <Meta label="Хаяг" value={tenant.address} />}
          {tenant.phone && (
            <div>
              <p className="label">Утас</p>
              <a
                href={`tel:${tenant.phone}`}
                className="mt-2 block text-[clamp(18px,2vw,26px)] tracking-[-0.03em] transition-opacity hover:opacity-60"
              >
                {tenant.phone}
              </a>
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="numeral mt-2 text-[clamp(18px,2vw,26px)] tracking-[-0.03em]">{value}</p>
    </div>
  );
}
