import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../lib/api';
import {
  checkPhoneVerifyStatus,
  loginWithPassword,
  registerWithPassword,
  resetPasswordWithPhone,
  startPhoneVerify,
  useAccount,
  verifyPhoneCode,
} from '../store/auth';
import { Button, Field, Input, Page } from '../components/ui';


export function VerifyMnPhoneAuth({ onSuccess }: { onSuccess: () => void }) {

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [text, setText] = useState('');
  const [shortcode, setShortcode] = useState('144773');
  const [displayInstruction, setDisplayInstruction] = useState('');
  const [smsUri, setSmsUri] = useState('');
  const [loading, setLoading] = useState(false);

  // Poll GET /sessions/:sessionId every 3 seconds
  useEffect(() => {
    if (step !== 'code' || !sessionId) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await checkPhoneVerifyStatus(sessionId);
        if (isMounted && res.verified) {
          clearInterval(interval);
          toast.success('SMS баталгаажлаа! Нэвтэрч байна...');
          await verifyPhoneCode(phone, undefined, sessionId);
          onSuccess();
        }
      } catch (err) {
        // Silently ignore 404 / 429 polling errors
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [step, sessionId, phone, onSuccess]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 8) {
      toast.error('Утасны дугаараа 8 оронтой оруулна уу');
      return;
    }
    setLoading(true);
    try {
      const res = await startPhoneVerify(phone);
      setSessionId(res.sessionId);
      setText(res.text);
      setShortcode(res.shortcode || '144773');
      setDisplayInstruction(res.displayInstruction || `${res.shortcode || '144773'} дугаарт "${res.text}" гэж SMS илгээнэ үү`);
      setSmsUri(res.smsUri);
      toast.success(res.displayInstruction || '144773 SMS баталгаажуулалт эхэллээ');
      setStep('code');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'SMS баталгаажуулалт эхлүүлэхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {step === 'phone' ? (
        <form onSubmit={handleStart} className="space-y-4">
          <Field label="Утасны дугаар" hint="144773 дугаар руу MO SMS баталгаажилт илгээнэ">
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="90144773"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Button type="submit" full size="lg" loading={loading}>
            144773 SMS Баталгаажуулалт Эхлүүлэх (Verify.MN)
          </Button>
        </form>
      ) : (
        <div className="space-y-5 text-center">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-xs font-semibold text-muted">
              {displayInstruction || `${shortcode} дугаарт SMS илгээнэ үү:`}
            </p>
            <p className="mt-2 font-mono text-xl font-bold tracking-widest text-primary">{text}</p>
            <a
              href={smsUri || `sms:${shortcode}?body=${text}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-xs font-semibold text-white transition-transform active:scale-95"
            >
              Шууд SMS Илгээх ({shortcode})

            </a>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted">
            <span className="inline-block size-2 animate-ping rounded-full bg-primary" />
            <span>SMS баталгаажуулалтыг шалгаж байна (Автомат)...</span>
          </div>

          <button
            type="button"
            onClick={() => setStep('phone')}
            className="text-xs text-muted hover:text-ink hover:underline"
          >
            ← Утасны дугаар өөрчлөх
          </button>
        </div>
      )}
    </div>
  );
}




export function PlatformLogin() {
  const navigate = useNavigate();
  const { isSignedIn, ready } = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Ажилтан бол /dashboard role-ийг нь таньж тусдаа самбар руу шууд оруулна.
  if (ready && isSignedIn) return <Navigate to="/dashboard" replace />;

  return (
    <AuthShell title="Нэвтрэх" subtitle="И-мэйл, нууц үг эсвэл Verify.MN ашиглана">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          await loginWithPassword(email, password);
          toast.success('Амжилттай нэвтэрлээ');
          navigate('/dashboard');
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Нэвтрэхэд алдаа гарлаа');
        } finally { setLoading(false); }
      }}>
        <Field label="И-мэйл"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Нууц үг"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <div className="text-right"><Link to="/forgot-password" className="text-xs text-muted hover:text-ink hover:underline">Нууц үгээ мартсан уу?</Link></div>
        <Button type="submit" full size="lg" loading={loading}>Нэвтрэх</Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />эсвэл<span className="h-px flex-1 bg-line" /></div>
      <VerifyMnPhoneAuth onSuccess={() => navigate('/dashboard')} />
      <p className="mt-6 text-center text-[13px] text-muted">Бүртгэлгүй юу? <Link className="text-ink underline" to="/register">Бүртгүүлэх</Link></p>
    </AuthShell>
  );
}

export function PlatformRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  return <AuthShell title="Бүртгүүлэх" subtitle="Шинэ хэрэглэгчийн бүртгэл үүсгэнэ">
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      try {
        await registerWithPassword(form);
        toast.success('Бүртгэл амжилттай үүслээ'); navigate('/');
      } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Бүртгүүлэхэд алдаа гарлаа'); }
      finally { setLoading(false); }
    }}>
      <Field label="Нэр"><Input value={form.name} onChange={(e) => set('name', e.target.value)} required minLength={2} /></Field>
      <Field label="И-мэйл"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required /></Field>
      <Field label="Утас"><Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required minLength={8} /></Field>
      <Field label="Нууц үг"><Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} /></Field>
      <Button type="submit" full size="lg" loading={loading}>Бүртгүүлэх</Button>
    </form>
    <p className="mt-6 text-center text-[13px] text-muted">Бүртгэлтэй юу? <Link className="text-ink underline" to="/login">Нэвтрэх</Link></p>
  </AuthShell>;
}

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'reset'>('phone');
  const [phone, setPhone] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [instruction, setInstruction] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  return <AuthShell title="Нууц үг сэргээх" subtitle="Verify.MN-ээр утсаа баталгаажуулна">
    {step === 'phone' ? <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      try {
        const result = await startPhoneVerify(phone);
        setSessionId(result.sessionId);
        setInstruction(result.displayInstruction || `${result.shortcode} дугаарт ${result.text} гэж SMS илгээнэ үү`);
        setStep('reset');
      } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Баталгаажуулалт эхлүүлэхэд алдаа гарлаа'); }
      finally { setLoading(false); }
    }}>
      <Field label="Бүртгэлтэй утас"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={8} /></Field>
      <Button type="submit" full size="lg" loading={loading}>Утсаа баталгаажуулах</Button>
    </form> : <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (password !== confirm) return toast.error('Нууц үгнүүд таарахгүй байна');
      setLoading(true);
      try {
        const status = await checkPhoneVerifyStatus(sessionId);
        if (!status.verified) return toast.error('SMS баталгаажуулалт хараахан дуусаагүй байна');
        await resetPasswordWithPhone({ phone, sessionId, password });
        toast.success('Нууц үг амжилттай шинэчлэгдлээ'); navigate('/login');
      } catch (err) { toast.error(err instanceof ApiError ? err.message : 'Нууц үг шинэчлэхэд алдаа гарлаа'); }
      finally { setLoading(false); }
    }}>
      <p className="border border-line bg-paper p-4 text-sm text-muted">{instruction}</p>
      <Field label="Шинэ нууц үг"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></Field>
      <Field label="Нууц үг давтах"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} /></Field>
      <Button type="submit" full size="lg" loading={loading}>Нууц үг шинэчлэх</Button>
    </form>}
    <p className="mt-6 text-center text-[13px]"><Link className="text-muted hover:text-ink" to="/login">Нэвтрэх рүү буцах</Link></p>
  </AuthShell>;
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
  return (
    <Page className="mx-auto max-w-sm px-5 pt-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Masteurent
      </Link>
      <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-1 mb-7 text-muted">{subtitle}</p>
      {children}
    </Page>
  );
}
