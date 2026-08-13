import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCheck, CreditCard, Loader2, QrCode, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { mnt } from '../../lib/format';
import type { Payment } from '../../lib/types';
import { useTenant } from '../../layouts/StorefrontLayout';
import { Button, Card, Page, Skeleton } from '../../components/ui';

/**
 * Төлбөрийн хуудас.
 *
 * Төлөгдсөн эсэхийг ЗӨВХӨН серверээс асууна — QPay-гийн хувьд сервер нь
 * QPay-гийн payment/check API-аар баталгаажуулдаг. Энэ хуудас "төлсөн"
 * гэж өөрөө шийдэх ямар ч эрхгүй.
 */
export function Pay() {
  const { slug = '', paymentId = '' } = useParams();
  const [params] = useSearchParams();
  const tenant = useTenant();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => api<{ payment: Payment }>(`/payments/${paymentId}`),
    // Хэрэглэгч банкны апп руу орсон байхад төлөв өөрчлөгдөнө.
    refetchInterval: (q) => (q.state.data?.payment.status === 'PAID' ? false : 4000),
  });

  const payment = data?.payment;
  const paid = payment?.status === 'PAID';
  const trackToken = payment?.trackToken;

  useEffect(() => {
    if (params.get('cancelled')) toast('Төлбөр цуцлагдлаа');
  }, [params]);

  // Төлөгдсөний дараа захиалгаа хянах хуудас руу. Хянах холбоос нь
  // төлбөрийн хариунд ирдэг тул зочин хэрэглэгч ч саадгүй үргэлжилнэ.
  useEffect(() => {
    if (!paid) return;
    toast.success('Төлбөр амжилттай!');
    const timer = setTimeout(() => {
      navigate(trackToken ? `/t/${slug}/order/${trackToken}` : `/t/${slug}/orders`, {
        replace: true,
      });
    }, 2200);
    return () => clearTimeout(timer);
  }, [paid, trackToken, navigate, slug]);

  if (isLoading) {
    return (
      <Page className="mx-auto max-w-md px-5 pt-10">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-5 h-72 w-full" />
      </Page>
    );
  }

  if (isError || !payment) {
    return (
      <Page className="mx-auto max-w-md px-5 pt-24 text-center">
        <p className="label">Олдсонгүй</p>
        <h1 className="mt-4 text-[clamp(24px,4vw,38px)] tracking-[-0.04em]">Төлбөр байхгүй</h1>
        <Link
          to={`/t/${slug}/orders`}
          className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-[13.5px] font-medium text-bg"
        >
          Захиалгууд руу
        </Link>
      </Page>
    );
  }

  return (
    <Page className="mx-auto max-w-md px-5 pt-8 sm:px-8">
      <Link
        to={`/t/${slug}/orders`}
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Захиалгууд
      </Link>

      <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Төлбөр</h1>
      <p className="mt-1 text-muted">
        {tenant.name} · <span className="tabular-nums">{mnt(payment.amount)}</span>
      </p>

      {paid ? (
        <PaidCard />
      ) : payment.provider === 'QPAY' ? (
        <QpayCard payment={payment} />
      ) : payment.provider === ('WIRE' as any) ? (
        <WireCard payment={payment} />
      ) : (
        <StripeCard payment={payment} />
      )}
    </Page>
  );
}

function WireCard({ payment }: { payment: Payment }) {
  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <CreditCard size={15} />
        Wire Нэгдсэн Төлбөр (Монгол Банкнууд & Карт)
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Wire Payment Gateway-ээр дамжуулан Khan Bank, SocialPay, QPay, MonPay, HiPay болон картаар төлөх боломжтой.
      </p>

      {payment.checkoutUrl && (
        <a href={payment.checkoutUrl} target="_blank" rel="noreferrer" className="mt-5 block">
          <Button full size="lg">
            Wire Төлбөрийн Хуудас Рүү Шилжих · {mnt(payment.amount)}
          </Button>
        </a>
      )}

      <div className="mt-5 flex items-center justify-center gap-2 border-t border-line pt-4 text-[13px] text-muted">
        <Loader2 size={14} className="animate-spin" />
        Төлбөрийг хүлээж байна…
      </div>
    </Card>
  );
}


function PaidCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="mt-6 flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-ok/10 text-ok">
          <CheckCheck size={26} />
        </span>
        <p className="text-[17px] font-semibold">Төлбөр баталгаажлаа</p>
        <p className="text-[13.5px] text-muted">Захиалга хянах хуудас руу шилжиж байна…</p>
      </Card>
    </motion.div>
  );
}

function QpayCard({ payment }: { payment: Payment }) {
  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <QrCode size={15} />
        Банкны аппаараа QR-ыг уншуулна уу
      </div>

      {payment.qrImage ? (
        <img
          src={
            payment.qrImage.startsWith('data:')
              ? payment.qrImage
              : `data:image/png;base64,${payment.qrImage}`
          }
          alt="QPay QR"
          className="mx-auto mt-5 size-56 rounded-[12px] border border-line bg-white p-2"
        />
      ) : (
        <div className="mt-5 rounded-[12px] border border-dashed border-line p-6 text-center text-[13px] text-muted">
          QR зураг ирсэнгүй.
          {payment.qrText && <span className="mt-2 block break-all text-faint">{payment.qrText}</span>}
        </div>
      )}

      {payment.checkoutUrl && (
        <a href={payment.checkoutUrl} target="_blank" rel="noreferrer" className="mt-4 block">
          <Button variant="secondary" full>
            Утсан дээрээ нээх
          </Button>
        </a>
      )}

      <div className="mt-5 flex items-center justify-center gap-2 border-t border-line pt-4 text-[13px] text-muted">
        <Loader2 size={14} className="animate-spin" />
        Төлбөрийг хүлээж байна…
      </div>
    </Card>
  );
}

function StripeCard({ payment }: { payment: Payment }) {
  const cancelled = payment.status === 'CANCELLED' || payment.status === 'FAILED';

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <CreditCard size={15} />
        Картын төлбөр — Stripe
      </div>

      {cancelled ? (
        <div className="mt-5 flex items-center gap-3 text-bad">
          <XCircle size={20} />
          <p className="text-[14px]">Төлбөр дуусаагүй байна. Дахин оролдоно уу.</p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Stripe-ийн аюулгүй хуудас руу шилжиж картаа оруулна. Төлбөр
            баталгаажмагц энэ хуудас өөрөө шинэчлэгдэнэ.
          </p>
          {payment.checkoutUrl && (
            <a href={payment.checkoutUrl} className="mt-5 block">
              <Button full size="lg">
                Төлбөр төлөх · {mnt(payment.amount)}
              </Button>
            </a>
          )}
          <div className="mt-5 flex items-center justify-center gap-2 border-t border-line pt-4 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" />
            Төлбөрийг хүлээж байна…
          </div>
        </>
      )}
    </Card>
  );
}
