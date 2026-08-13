import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { cn } from '../lib/cn';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Доороос гарч ирэх энгийн илрэл. */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Мөр мөрөөр нь маскнаас өргөгдөж гарах текст —
 * editorial толгойн гол хөдөлгөөн.
 */
export function MaskLines({
  lines,
  className,
  delay = 0,
  stagger = 0.09,
}: {
  lines: ReactNode[];
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  return (
    <span className={cn('block', className)}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span
            className="block"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: delay + i * stagger, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Гүйлгэхэд илрэх маск текст (viewport дотор орсон үед). */
export function MaskLinesInView({
  lines,
  className,
  stagger = 0.08,
}: {
  lines: ReactNode[];
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });

  return (
    <span ref={ref} className={cn('block', className)}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span
            className="block"
            initial={{ y: '105%' }}
            animate={inView ? { y: 0 } : { y: '105%' }}
            transition={{ duration: 0.95, delay: i * stagger, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Гүйлгэлтэд уялдсан parallax — зураг удаан хөдөлнө. */
export function Parallax({
  children,
  distance = 70,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);

  return (
    <div ref={ref} className={cn('overflow-hidden', className)}>
      <motion.div style={{ y }} className="size-full">
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Доороос дээш нээгдэх маск — зургийн editorial илрэл.
 *
 * `immediate` — mount дээр шууд нээгдэнэ. Дэлгэц дүүрэн эхний блок
 * (hero, ковер) дээр ЗААВАЛ үүнийг хэрэглэнэ: gүйлгэлтээр өдөөгддөг
 * whileInView ажиллахгүй тохиолдолд контент бүрмөсөн таслагдсан хэвээр
 * үлдэж, том хоосон зай үүсгэдэг.
 */
export function CurtainReveal({
  children,
  className,
  delay = 0,
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  immediate?: boolean;
}) {
  const open = { clipPath: 'inset(0% 0% 0% 0%)' };

  return (
    <motion.div
      initial={{ clipPath: 'inset(100% 0% 0% 0%)' }}
      {...(immediate
        ? { animate: open }
        : { whileInView: open, viewport: { once: true, margin: '-10%' } })}
      transition={{ duration: 1.15, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Тасралтгүй гүйх зурвас. */
export function Marquee({
  text,
  speed = 38,
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const items = Array.from({ length: 6 });
  return (
    <div className={cn('flex overflow-hidden select-none', className)}>
      <motion.div
        className="flex shrink-0 items-center gap-10 pr-10"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
      >
        {items.concat(items).map((_, i) => (
          <span key={i} className="flex shrink-0 items-center gap-10 whitespace-nowrap">
            {text}
            <span className="inline-block h-px w-14 bg-current opacity-30" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/** Харагдах үед 0-ээс тоолж өсөх тоо. */
export function Counter({
  to,
  duration = 1.6,
  format = (n: number) => n.toLocaleString('mn-MN'),
  className,
}: {
  to: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      // ease-out — эхэндээ хурдан, төгсгөлд зөөлөн зогсоно
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={cn('numeral', className)}>
      {format(value)}
    </span>
  );
}

/** Хулганы араас зөөлөн дагах утга — hover preview-д. */
export function useCursor() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 28, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 220, damping: 28, mass: 0.5 });

  const onMove = (e: React.MouseEvent) => {
    x.set(e.clientX);
    y.set(e.clientY);
  };

  return { x: sx as MotionValue<number>, y: sy as MotionValue<number>, onMove };
}

/** Гүйлгэлтийн явцыг харуулах дээд шугам. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30, mass: 0.3 });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-px origin-left bg-ink"
    />
  );
}
