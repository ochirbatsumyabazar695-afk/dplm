import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

// --- Button ------------------------------------------------------------------
// Editorial дүрэм: товч дугуй капсул, оролт дөрвөлжин. Хоёрын ялгаа нь
// "үйлдэл" ба "талбар"-ыг нэг харцаар салгаж өгдөг.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  full?: boolean;
};

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-white hover:opacity-85',
  secondary: 'border border-line-strong text-ink hover:border-ink',
  ghost: 'text-muted hover:text-ink hover:bg-ink/[0.05]',
  danger: 'border border-bad/30 text-bad hover:bg-bad/[0.07]',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-4 text-[12.5px]',
  md: 'h-11 px-6 text-[13.5px]',
  lg: 'h-13 px-7 text-[14px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, full, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium',
        'transition-all duration-300 ease-out active:scale-[0.985]',
        'disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-ink',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="size-3.5 rounded-full border border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
});

// --- Хэлбэрийн элементүүд -----------------------------------------------------

const fieldBase =
  'w-full border border-line bg-surface px-3.5 text-[14px] placeholder:text-faint ' +
  'transition-colors duration-200 outline-none focus:border-ink';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, 'py-2.5 min-h-22 resize-none', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(fieldBase, 'h-11 appearance-none pr-9 bg-no-repeat', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236b6862' stroke-width='1.5'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 12px center',
        }}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
      {error ? (
        <motion.span
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 block text-[12.5px] text-bad"
        >
          {error}
        </motion.span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12.5px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

// --- Гадаргуу ----------------------------------------------------------------

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2.5 py-1',
        'text-[10.5px] font-medium tracking-[0.1em] uppercase whitespace-nowrap',
        className ?? 'border-line text-muted',
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer', className)} />;
}

/**
 * Зураг ачаалагдахгүй бол монограмм рүү унана —
 * линк тасарсан ч харагдац эвдрэхгүй, эможи ашиглахгүй.
 */
export function SmartImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  /** Дэлгэц дүүрэн эхний зураг (ковер) дээр — lazy бол оройтож ачаална. */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn('relative flex items-center justify-center overflow-hidden bg-paper', className)}
      >
        {/* Зураасан бүтэц — том талбай хоосон биш, зориудын харагдацтай байхын тулд. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 10px)',
          }}
        />
        <span className="relative line-clamp-2 px-4 text-center text-[11px] font-medium tracking-[0.2em] text-faint uppercase select-none">
          {alt.trim() || 'Masteurent'}
        </span>
      </div>
    );
  }

  // React 18 нь `fetchPriority`-г танихгүй (энэ нь React 19-ийн бичлэг) —
  // DOM-ын жинхэнэ нэрээр нь жижиг үсгээр дамжуулна.
  const priority = eager ? ({ fetchpriority: 'high' } as Record<string, string>) : {};

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      {...priority}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

// --- Sheet (доороос гарч ирэх) ------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88vh] w-full max-w-lg flex-col',
              'border border-line bg-surface shadow-[0_-10px_50px_rgba(0,0,0,0.08)]',
              'sm:bottom-5',
            )}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="label">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Хаах"
                className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
            {footer && <div className="border-t border-line p-4">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Хоосон төлөв -------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center px-6 py-20 text-center"
    >
      {icon && <div className="mb-5 text-faint">{icon}</div>}
      <h3 className="text-[17px] tracking-[-0.02em]">{title}</h3>
      {description && <p className="mt-2 max-w-xs text-[14px] text-muted">{description}</p>}
      {action && <div className="mt-7">{action}</div>}
    </motion.div>
  );
}

/** Хуудас солигдоход зөөлөн шилжилт. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
