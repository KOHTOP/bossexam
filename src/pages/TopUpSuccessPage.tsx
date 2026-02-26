import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';

export const TopUpSuccessPage: React.FC = () => {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'CONFIRMED' | 'PENDING' | 'ERROR' | 'CANCELED' | 'NONE'>('loading');
  const [credited, setCredited] = useState(false);
  const [productId, setProductId] = useState<number | null>(null);
  const [deliveryToken, setDeliveryToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await authFetch('/api/payment/check-return');
        const data = await res.json();
        if (cancelled) return;
        setStatus(data.status || 'ERROR');
        setCredited(!!data.credited);
        if (data.product_id != null) setProductId(data.product_id);
        if (data.delivery_token) setDeliveryToken(data.delivery_token);
        if (data.credited) refreshUser?.();
        if (data.delivery_token) {
          window.location.href = `/delivery/${data.delivery_token}`;
          return;
        }
      } catch {
        if (!cancelled) setStatus('ERROR');
      }
    };
    check();
    return () => { cancelled = true; };
  }, [refreshUser]);

  return (
    <div className="max-w-md mx-auto text-center space-y-6 py-12">
      {status === 'loading' && (
        <>
          <Loader2 size={48} className="animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-medium">Проверяем оплату...</p>
        </>
      )}
      {(status === 'CONFIRMED' || credited) && (
        <>
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 size={48} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black">{productId ? 'Товар оплачен' : 'Баланс пополнен'}</h1>
          <p className="text-muted-foreground">
            {productId ? 'Товар добавлен в раздел «Мои покупки» в профиле.' : 'Средства зачислены на ваш счёт.'}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {productId && deliveryToken && (
              <Link to={`/delivery/${deliveryToken}`} className="inline-block bg-primary text-white px-8 py-3 rounded-2xl font-bold hover:bg-primary/90">
                Перейти к выдаче
              </Link>
            )}
            {productId && (
              <Link to="/profile" className="inline-block border border-[var(--border)] px-8 py-3 rounded-2xl font-bold hover:bg-[var(--muted)]">
                В покупки
              </Link>
            )}
            <Link to={productId ? '/products' : '/topup'} className="inline-block border border-[var(--border)] px-8 py-3 rounded-2xl font-bold hover:bg-[var(--muted)]">
              {productId ? 'В каталог' : 'Пополнить снова'}
            </Link>
          </div>
        </>
      )}
      {status === 'PENDING' && (
        <>
          <Loader2 size={48} className="animate-spin text-primary mx-auto" />
          <h1 className="text-xl font-bold">Ожидаем подтверждение</h1>
          <p className="text-muted-foreground text-sm">Платёж в обработке. Обновите страницу через минуту.</p>
          <Link to="/topup" className="inline-block border border-[var(--border)] px-6 py-2 rounded-xl font-medium hover:bg-[var(--muted)]">
            Вернуться к пополнению
          </Link>
        </>
      )}
      {(status === 'ERROR' || status === 'CANCELED' || status === 'NONE') && (
        <>
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <XCircle size={48} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Оплата не прошла</h1>
          <p className="text-muted-foreground text-sm">Попробуйте ещё раз или выберите другой способ.</p>
          <Link to="/topup" className="inline-block bg-primary text-white px-8 py-3 rounded-2xl font-bold hover:bg-primary/90">
            К пополнению
          </Link>
        </>
      )}
    </div>
  );
};
