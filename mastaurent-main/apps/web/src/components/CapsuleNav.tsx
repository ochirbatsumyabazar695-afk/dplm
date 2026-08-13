import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
};

/**
 * Capsule navigation — идэвхтэй хэсгийн ард accent толбо `layoutId`-аар гулсана.
 * Доор байрлахад доош гүйлгэхэд нуугдана (thumb-ийн зам чөлөөлнө).
 */
export function CapsuleNav({
  items,
  position = 'bottom',
  right,
}: {
  items: NavItem[];
  position?: 'bottom' | 'top';
  right?: React.ReactNode;
}) {
  const hidden = useHideOnScroll(position === 'bottom');
  const { pathname } = useLocation();

  return (
    <motion.nav
      initial={false}
      animate={{
        y: hidden ? (position === 'bottom' ? 96 : -96) : 0,
        opacity: hidden ? 0 : 1,
      }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'fixed inset-x-0 z-30 flex justify-center px-4',
        position === 'bottom' ? 'bottom-5 pb-[env(safe-area-inset-bottom)]' : 'top-4',
      )}
    >
      <div
        className={cn(
          'glass flex items-center gap-1 rounded-full border border-black/[0.07] p-1.5',
          'shadow-[0_6px_28px_rgba(0,0,0,0.10)]',
        )}
      >
        {items.map((item) => {
          const active = item.end
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to + '/');

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-medium',
                'transition-colors duration-200',
                active ? 'text-white' : 'text-muted hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <item.icon size={17} strokeWidth={2} />
                <span className={cn(active ? 'inline' : 'hidden sm:inline')}>{item.label}</span>
                {!!item.badge && (
                  <span
                    className={cn(
                      'ml-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10.5px] font-semibold',
                      active ? 'bg-white/25 text-white' : 'bg-accent text-white',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
            </NavLink>
          );
        })}
        {right}
      </div>
    </motion.nav>
  );
}

/** Доош гүйлгэхэд нуух, дээш гүйлгэхэд гаргах. */
function useHideOnScroll(enabled: boolean) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 8) {
        setHidden(y > last && y > 120);
        last = y;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return hidden;
}
