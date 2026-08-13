import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useTenant } from '../../layouts/StorefrontLayout';
import { Button, Field, Input, Page } from '../../components/ui';

const loginSchema = z.object({
  email: z.string().email('И-мэйл буруу байна'),
  password: z.string().min(1, 'Нууц үгээ оруулна уу'),
});

export function Login() {
  const { slug = '' } = useParams();
  const tenant = useTenant();
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  return (
    <AuthShell title="Тавтай морил" subtitle={`${tenant.name} — нэвтрэх`}>
      <form
        onSubmit={handleSubmit(async (v) => {
          try {
            await login(slug, v.email, v.password);
            toast.success('Амжилттай нэвтэрлээ');
            navigate(`/t/${slug}`);
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : 'Нэвтрэхэд алдаа гарлаа');
          }
        })}
        className="space-y-4"
      >
        <Field label="И-мэйл" error={errors.email?.message}>
          <Input type="email" placeholder="name@mail.mn" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Нууц үг" error={errors.password?.message}>
          <Input type="password" placeholder="••••••" autoComplete="current-password" {...register('password')} />
        </Field>

        <Button type="submit" full size="lg" loading={isSubmitting}>
          Нэвтрэх
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setValue('email', 'hereglegch@hool.mn');
          setValue('password', '123456');
          toast('Демо хэрэглэгчийн мэдээлэл бөглөгдлөө');
        }}
        className="mt-3 w-full rounded-[11px] border border-dashed border-line py-2.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        Демо хэрэглэгчээр туршиж үзэх
      </button>

      <p className="mt-6 text-center text-[14px] text-muted">
        Бүртгэлгүй юу?{' '}
        <Link to={`/t/${slug}/register`} className="font-medium text-ink underline-offset-4 hover:underline">
          Бүртгүүлэх
        </Link>
      </p>
    </AuthShell>
  );
}

const registerSchema = z.object({
  name: z.string().min(2, 'Нэр хамгийн багадаа 2 тэмдэгт'),
  email: z.string().email('И-мэйл буруу байна'),
  phone: z.string().regex(/^\d{8}$/, 'Утасны дугаар 8 оронтой тоо байна'),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт'),
});

export function Register() {
  const { slug = '' } = useParams();
  const tenant = useTenant();
  const navigate = useNavigate();
  const registerUser = useAuth((s) => s.register);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  return (
    <AuthShell title="Бүртгүүлэх" subtitle={`${tenant.name}-д шинэ хэрэглэгч`}>
      <form
        onSubmit={handleSubmit(async (v) => {
          try {
            await registerUser(slug, v);
            toast.success('Бүртгэл амжилттай!');
            navigate(`/t/${slug}`);
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : 'Бүртгүүлэхэд алдаа гарлаа');
          }
        })}
        className="space-y-4"
      >
        <Field label="Нэр" error={errors.name?.message}>
          <Input placeholder="Батбаяр" {...register('name')} />
        </Field>
        <Field label="И-мэйл" error={errors.email?.message}>
          <Input type="email" placeholder="name@mail.mn" {...register('email')} />
        </Field>
        <Field label="Утас" error={errors.phone?.message}>
          <Input inputMode="numeric" placeholder="99112233" {...register('phone')} />
        </Field>
        <Field label="Нууц үг" error={errors.password?.message} hint="Хамгийн багадаа 6 тэмдэгт">
          <Input type="password" placeholder="••••••" autoComplete="new-password" {...register('password')} />
        </Field>

        <Button type="submit" full size="lg" loading={isSubmitting}>
          Бүртгүүлэх
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-muted">
        Бүртгэлтэй юу?{' '}
        <Link to={`/t/${slug}/login`} className="font-medium text-ink underline-offset-4 hover:underline">
          Нэвтрэх
        </Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { slug = '' } = useParams();
  return (
    <Page className="mx-auto max-w-sm px-5 pt-10">
      <Link
        to={`/t/${slug}`}
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Буцах
      </Link>
      <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-1 mb-7 text-muted">{subtitle}</p>
      {children}
    </Page>
  );
}
