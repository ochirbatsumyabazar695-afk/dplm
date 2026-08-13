import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import { mnt } from '../lib/format';
import type { TenantCard } from '../lib/types';

import {
  Counter,
  CurtainReveal,
  Marquee,
  MaskLines,
  MaskLinesInView,
  Parallax,
  Reveal,
  ScrollProgress,
  useCursor,
} from '../components/motion';
import { SmartImage } from '../components/ui';
import { useAccount, useSignOut, useStaffMember } from '../store/auth';
import { cn } from '../lib/cn';


const HERO_IMAGE =
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2000&q=80';
const ATELIER_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80';

export function Landing() {
  useEffect(() => {
    document.title = 'Masteurent — Хоолны хүргэлтийн платформ';
    document.documentElement.style.setProperty('--accent', '#12110f');
    document.documentElement.style.setProperty('--accent-soft', '#12110f14');
  }, []);

  // Ресторануудын жагсаалт зөвхөн нэвтэрсэн хэрэглэгчид. Сервер ч мөн
  // адил хамгаалагдсан — энэ нь зөвхөн харагдацын тал.
  const { isSignedIn, ready } = useAccount();

  const { data } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api<{ tenants: TenantCard[] }>('/tenants'),
    enabled: ready && isSignedIn,
  });

  const tenants = data?.tenants ?? [];
  const dishCount = tenants.reduce((s, t) => s + t._count.menuItems, 0);
  const avgEta = tenants.length
    ? Math.round(tenants.reduce((s, t) => s + t.etaMinutes, 0) / tenants.length)
    : 0;

  return (
    <div className="min-h-dvh">
      <ScrollProgress />
      <Header />
      <Hero />
      <HeroImage />

      <Marquee
        text="MASTEURENT"
        speed={44}
        className="border-y border-line py-4 text-[13px] tracking-[0.35em] text-muted uppercase"
      />

      <Manifesto />
      {isSignedIn ? (
        <>
          <Stats restaurants={tenants.length} dishes={dishCount} avgEta={avgEta} />
          <RestaurantIndex tenants={tenants} />
        </>
      ) : (
        <SignInGate ready={ready} />
      )}
      <Capabilities />
      <Closing />
      <Footer />
    </div>
  );
}

// --- Толгой -------------------------------------------------------------------

function Header() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const signOut = useSignOut();

  // Ажилтны эрхийг dashboard-тай ЯГ нэг эх сурвалжаас уншина. Тусдаа
  // хүсэлт бичвэл хоёр газар зөрөх эрсдэлтэй — самбар нээгээд буцчихдаг.
  const { user: staff, account, isSignedIn } = useStaffMember();

  const hasSubscription = !!staff || !!account?.isPlatformAdmin;

  useEffect(() => scrollY.on('change', (v) => setSolid(v > 40)), [scrollY]);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-500',
        solid ? 'glass border-b border-line' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <Link to="/" className="text-[13px] font-medium tracking-[0.3em] uppercase">
          Masteurent
        </Link>

        <nav className="flex items-center gap-8">
          <a href="#restaurants" className="hidden text-[13px] text-muted transition-colors hover:text-ink sm:block">
            Ресторанууд
          </a>
          <a href="#platform" className="hidden text-[13px] text-muted transition-colors hover:text-ink sm:block">
            Платформ
          </a>
          {isSignedIn && account?.isPlatformAdmin && (
            <Link
              to="/admin/requests"
              className="hidden text-[13px] text-muted transition-colors hover:text-ink sm:block"
            >
              Хүсэлтүүд
            </Link>
          )}
          {isSignedIn && !account?.isPlatformAdmin && (
            <Link
              to="/restaurant-request"
              className="hidden text-[13px] text-muted transition-colors hover:text-ink sm:block"
            >
              Ресторан нээх
            </Link>
          )}

          {!isSignedIn ? (
            <Link
              to="/login"
              className="group flex items-center gap-1.5 rounded-full border border-ink px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-ink hover:text-bg"
            >
              Нэвтрэх
              <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              {hasSubscription && (
                <Link
                  to="/dashboard/login"
                  className="group flex items-center gap-1.5 rounded-full border border-ink px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-ink hover:text-bg"
                >
                  Самбар
                  <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              )}
              <button
                onClick={() => void signOut({ redirectUrl: '/' })}
                className="text-[12.5px] font-medium text-muted transition-colors hover:text-ink cursor-pointer"
              >
                Гарах
              </button>
            </div>
          )}
        </nav>
      </div>
    </motion.header>
  );
}



// --- Hero ---------------------------------------------------------------------

function Hero() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pt-36 pb-16 lg:px-10 lg:pt-44">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="label mb-8"
          >
            01 — Multi-tenant платформ
          </motion.p>

          <h1 className="display text-[clamp(44px,9vw,132px)]">
            <MaskLines
              delay={0.25}
              lines={['Ресторан бүрийн', <span key="2" className="text-faint">өөрийн систем.</span>]}
            />
          </h1>
        </div>

        <div className="flex flex-col justify-end lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rule pt-5">
              <p className="max-w-sm text-[15px] leading-relaxed text-muted">
                Masteurent нь ресторан бүрт тусдаа онлайн дэлгүүр, цэсний удирдлага, захиалгын
                урсгалыг нэг платформоос өгнө. Комиссгүй, өөрийн брэндээр.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#restaurants"
                  className="group flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-bg transition-opacity hover:opacity-85"
                >
                  Ресторанууд
                  <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                <Link
                  to="/dashboard/login"
                  className="rounded-full border border-line-strong px-6 py-3 text-[13.5px] font-medium transition-colors hover:border-ink"
                >
                  Демо самбар
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroImage() {
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 1.06]);

  return (
    <CurtainReveal delay={0.35} className="px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <Parallax distance={44} className="h-[52vh] min-h-80 lg:h-[70vh]">
          <motion.img
            src={HERO_IMAGE}
            alt="Ресторанны гал тогоо"
            style={{ scale }}
            className="size-full scale-110 object-cover"
          />
        </Parallax>

        <div className="mt-3 flex justify-between">
          <span className="label">Fig. 01</span>
          <span className="label">Улаанбаатар — 2026</span>
        </div>
      </div>
    </CurtainReveal>
  );
}

// --- Манифест -----------------------------------------------------------------

function Manifesto() {
  return (
    <section id="platform" className="mx-auto max-w-[1400px] px-6 py-28 lg:px-10 lg:py-40">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Reveal>
            <p className="label">02 — Танилцуулга</p>
          </Reveal>
        </div>

        <div className="lg:col-span-9">
          <h2 className="text-[clamp(26px,3.6vw,50px)] leading-[1.08] tracking-[-0.035em]">
            <MaskLinesInView
              lines={[
                'Хүргэлтийн платформ нь рестораны',
                'брэндийг далдлах ёсгүй. Masteurent',
                <span key="3" className="text-faint">эсрэгээрээ ажилладаг.</span>,
              ]}
            />
          </h2>

          <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:mt-20 lg:gap-16">
            <Reveal delay={0.05}>
              <div className="rule pt-5">
                <p className="text-[15px] leading-relaxed text-muted">
                  Ресторан бүр өөрийн хаяг, өөрийн өнгө, өөрийн цэстэй. Захиалга шууд тухайн
                  ресторан руу очих ба дундын шимтгэл байхгүй. Харилцагчийн мэдээлэл ресторанд
                  өөрт нь үлдэнэ.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="rule pt-5">
                <p className="text-[15px] leading-relaxed text-muted">
                  Технологийн тал дээр нэг систем. Цэс шинэчлэх, захиалга хүлээн авах, төлөв
                  солих, тайлан харах — бүгд нэг самбараас. Ресторан хоолондоо анхаарна.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      <Reveal className="mt-24 lg:mt-32">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <Parallax distance={30} className="lg:col-span-7 h-72 lg:h-[30rem]">
            <img
              src={ATELIER_IMAGE}
              alt="Тогоочийн ажлын байр"
              className="size-full scale-110 object-cover"
            />
          </Parallax>

          <div className="flex flex-col justify-end lg:col-span-5">
            <p className="text-[clamp(20px,2.2vw,30px)] leading-[1.25] tracking-[-0.03em]">
              «Ресторан бүр өөрийн харилцагчтайгаа шууд ажиллах ёстой.»
            </p>
            <p className="label mt-6">Masteurent — Платформын зарчим</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// --- Тоон үзүүлэлт ------------------------------------------------------------

function Stats({
  restaurants,
  dishes,
  avgEta,
}: {
  restaurants: number;
  dishes: number;
  avgEta: number;
}) {
  const items = [
    { value: restaurants, label: 'Идэвхтэй ресторан', suffix: '' },
    { value: dishes, label: 'Цэсэн дэх хоол', suffix: '' },
    { value: avgEta, label: 'Дундаж хүргэлт', suffix: ' мин' },
    { value: 0, label: 'Платформын комисс', suffix: '%' },
  ];

  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px px-6 lg:grid-cols-4 lg:px-10">
        {items.map((item, i) => (
          <Reveal key={item.label} delay={i * 0.07}>
            <div className={cn('py-12 lg:py-16', i > 0 && 'lg:border-l lg:border-line lg:pl-10')}>
              <p className="display text-[clamp(38px,5vw,68px)]">
                <Counter to={item.value} />
                {item.suffix}
              </p>
              <p className="label mt-3">{item.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// --- Ресторануудын индекс -----------------------------------------------------

/** Нэвтрээгүй үед ресторануудын оронд гарах хэсэг. */
function SignInGate({ ready }: { ready: boolean }) {
  return (
    <section id="restaurants" className="mx-auto mt-28 max-w-[1400px] px-6 lg:mt-40 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Reveal>
            <p className="label">03 — Индекс</p>
          </Reveal>
        </div>
        <div className="lg:col-span-9">
          <h2 className="text-[clamp(26px,4vw,54px)] leading-[1.02] tracking-[-0.04em]">
            <MaskLinesInView lines={['Ресторануудыг үзэхийн', 'тулд нэвтэрнэ үү']} />
          </h2>
        </div>
      </div>

      <Reveal delay={0.1}>
        <div className="rule mt-14 pt-10">
          <p className="max-w-xl text-[15px] leading-relaxed text-muted">
            Нэг бүртгэлээр платформ дээрх бүх ресторанд хандана. Захиалгын түүх,
            хаяг тань хадгалагдана.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="rounded-full bg-ink px-7 py-3.5 text-[13.5px] font-medium text-bg transition-opacity hover:opacity-85"
            >
              Бүртгүүлэх
            </Link>
            <Link
              to="/login"
              className="rounded-full border border-line px-7 py-3.5 text-[13.5px] font-medium transition-colors hover:border-line-strong"
            >
              Нэвтрэх
            </Link>
          </div>

          {!ready && <p className="mt-6 text-[13px] text-faint">Шалгаж байна…</p>}
        </div>
      </Reveal>
    </section>
  );
}

function RestaurantIndex({ tenants }: { tenants: TenantCard[] }) {
  const [hovered, setHovered] = useState<TenantCard | null>(null);
  const { x, y, onMove } = useCursor();

  return (
    <section id="restaurants" className="mx-auto max-w-[1400px] px-6 py-28 lg:px-10 lg:py-40">
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Reveal>
            <p className="label">03 — Индекс</p>
          </Reveal>
        </div>
        <div className="lg:col-span-9">
          <h2 className="text-[clamp(28px,4.4vw,60px)] leading-[1.02] tracking-[-0.04em]">
            <MaskLinesInView lines={['Платформ дээрх', 'ресторанууд']} />
          </h2>
        </div>
      </div>

      {/* Хулганы араас дагах урьдчилсан харагдац */}
      <motion.div
        style={{ x, y }}
        className="pointer-events-none fixed top-0 left-0 z-30 hidden lg:block"
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="-translate-x-1/2 -translate-y-1/2"
            >
              <img
                src={hovered.coverUrl ?? ''}
                alt=""
                className="h-64 w-96 object-cover"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-16 lg:mt-24" onMouseMove={onMove} onMouseLeave={() => setHovered(null)}>
        {tenants.map((tenant, i) => (
          <Reveal key={tenant.id} delay={i * 0.05}>
            <Link
              to={`/t/${tenant.slug}`}
              onMouseEnter={() => setHovered(tenant)}
              className={cn(
                'rule group grid grid-cols-12 items-baseline gap-4 py-7 transition-opacity duration-400',
                hovered && hovered.id !== tenant.id ? 'lg:opacity-35' : 'opacity-100',
              )}
            >
              <span className="label numeral col-span-2 lg:col-span-1">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="col-span-10 flex items-center gap-4 lg:col-span-5">
                <SmartImage
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  eager
                  className="size-11 shrink-0 rounded-[11px]"
                />
                <motion.h3
                  className="text-[clamp(22px,2.6vw,38px)] tracking-[-0.035em]"
                  whileHover={{ x: 12 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  {tenant.name}
                </motion.h3>
              </div>

              <p className="col-span-12 text-[14px] text-muted lg:col-span-3">{tenant.tagline}</p>

              <div className="col-span-12 flex items-center justify-between gap-6 lg:col-span-3 lg:justify-end">
                <span className="label numeral">{tenant.etaMinutes} мин</span>
                <span className="label numeral">{mnt(tenant.deliveryFee)}</span>
                <ArrowUpRight
                  size={18}
                  className="shrink-0 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
                />
              </div>
            </Link>
          </Reveal>
        ))}
        <div className="rule" />
      </div>
    </section>
  );
}

// --- Боломжууд ----------------------------------------------------------------

const CAPABILITIES = [
  {
    title: 'Өөрийн дэлгүүр',
    text: 'Ресторан бүрт тусдаа хаяг, лого, брэнд өнгө. Харилцагч тухайн рестораны орчинд захиалга өгнө — платформын нэр биш, рестораны нэр л харагдана.',
  },
  {
    title: 'Цэсний удирдлага',
    text: 'Ангилал, хоол, хэмжээ, нэмэлт сонголт бүрийг өөрсдөө удирдана. Дууссан хоолыг нэг товчоор нуух ба өөрчлөлт дэлгүүрт шууд тусна.',
  },
  {
    title: 'Захиалгын самбар',
    text: 'Шинэ захиалга самбарт өөрөө гарч ирнэ. Хүлээн авах, бэлтгэх, хүргэлтэнд гаргах — төлөв бүр нэг товч. Харилцагч тэр бүрийг шууд харна.',
  },
  {
    title: 'Тайлан',
    text: 'Өдрийн орлого, идэвхтэй захиалга, дундаж дүн, эрэлттэй хоол. Шийдвэр гаргахад хэрэгтэй хэмжүүр л харагдана.',
  },
];

function Capabilities() {
  return (
    <section className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1400px] px-6 py-28 lg:px-10 lg:py-40">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Reveal>
              <p className="label">04 — Боломжууд</p>
            </Reveal>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-[clamp(28px,4.4vw,60px)] leading-[1.02] tracking-[-0.04em]">
              <MaskLinesInView lines={['Ресторанд хэрэгтэй', 'зүйл л багтсан']} />
            </h2>
          </div>
        </div>

        <div className="mt-16 lg:mt-24">
          {CAPABILITIES.map((cap, i) => (
            <Reveal key={cap.title} delay={i * 0.06}>
              <div className="rule grid grid-cols-12 gap-4 py-10 lg:gap-8">
                <span className="label numeral col-span-12 lg:col-span-1">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="col-span-12 text-[clamp(20px,2.2vw,30px)] tracking-[-0.03em] lg:col-span-4">
                  {cap.title}
                </h3>
                <p className="col-span-12 max-w-xl text-[15px] leading-relaxed text-muted lg:col-span-7">
                  {cap.text}
                </p>
              </div>
            </Reveal>
          ))}
          <div className="rule" />
        </div>
      </div>
    </section>
  );
}

// --- Төгсгөл ------------------------------------------------------------------

function Closing() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-32 lg:px-10 lg:py-48">
      <Reveal>
        <p className="label">05 — Эхлэх</p>
      </Reveal>

      <h2 className="display mt-10 text-[clamp(38px,8vw,120px)]">
        <MaskLinesInView lines={['Рестораныхаа', <span key="2" className="text-faint">системийг эхлүүл.</span>]} />
      </h2>

      <Reveal delay={0.15}>
        <div className="mt-14 flex flex-wrap gap-3">
          <Link
            to="/dashboard/login"
            className="group flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[14px] font-medium text-bg transition-opacity hover:opacity-85"
          >
            Удирдлагын самбар
            <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <a
            href="#restaurants"
            className="rounded-full border border-line-strong px-7 py-3.5 text-[14px] font-medium transition-colors hover:border-ink"
          >
            Дэлгүүр үзэх
          </a>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-8 py-14">
          <div>
            <p className="label">Masteurent</p>
            <p className="mt-3 max-w-xs text-[14px] text-muted">
              Хоолны хүргэлтийн multi-tenant SaaS платформ.
            </p>
          </div>

          <div className="flex gap-12 text-[13.5px]">
            <div className="space-y-2">
              <p className="label">Платформ</p>
              <a href="#restaurants" className="block text-muted transition-colors hover:text-ink">
                Ресторанууд
              </a>
              <a href="#platform" className="block text-muted transition-colors hover:text-ink">
                Танилцуулга
              </a>
            </div>
            <div className="space-y-2">
              <p className="label">Ресторанд</p>
              <Link to="/dashboard/login" className="block text-muted transition-colors hover:text-ink">
                Нэвтрэх
              </Link>
            </div>
          </div>
        </div>

        <div className="overflow-hidden pb-6">
          <CurtainReveal>
            <p className="display w-full text-[clamp(50px,15vw,220px)] leading-[0.8]">Masteurent</p>
          </CurtainReveal>
        </div>

        <div className="rule flex flex-wrap justify-between gap-3 py-6">
          <span className="label">Дипломын төсөл — 2026</span>
          <span className="label">Улаанбаатар</span>
        </div>
      </div>
    </footer>
  );
}
