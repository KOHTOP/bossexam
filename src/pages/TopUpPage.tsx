import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CreditCard, QrCode, Bitcoin, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';

const DEFAULT_MIN = 1;

interface ProductInfo {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string | null;
  category?: string;
}

export const TopUpPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [minAmount, setMinAmount] = useState(DEFAULT_MIN);
  const [amount, setAmount] = useState(DEFAULT_MIN);
  const [method, setMethod] = useState<'sbp' | 'crypto' | 'card'>('sbp');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const productId = searchParams.get('product_id');
  const amountFromUrl = searchParams.get('amount');
  const isProductPay = productId != null && amountFromUrl != null;

  useEffect(() => {
    fetch('/api/settings/min_topup_amount')
      .then(res => res.json())
      .then(data => {
        const n = Math.max(1, parseInt(String(data.value || ''), 10) || DEFAULT_MIN);
        setMinAmount(n);
        if (!isProductPay) setAmount(prev => (prev < n ? n : prev));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isProductPay) {
      const n = Math.max(1, parseInt(amountFromUrl!, 10) || DEFAULT_MIN);
      setAmount(n);
    }
  }, [isProductPay, amountFromUrl]);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${productId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setProduct(data || null))
      .catch(() => setProduct(null));
  }, [productId]);

  useEffect(() => {
    if (searchParams.get('failed') === '1') {
      setMessage({ text: 'Оплата была отменена или не прошла. Попробуйте снова.', type: 'error' });
    }
  }, [searchParams]);

  const handleTopUp = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isProductPay && amount < minAmount) {
      setMessage({ text: `Минимальная сумма пополнения — ${minAmount} ₽`, type: 'error' });
      return;
    }
    setMessage(null);
    setLoading(true);
    try {
      const body: { amount: number; paymentMethod: string; product_id?: number } = { amount, paymentMethod: method };
      if (productId) body.product_id = parseInt(productId, 10);
      const res = await authFetch('/api/payment/create', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        if (data.delivery_token) {
          window.location.href = `${window.location.origin}/delivery/${data.delivery_token}`;
          return;
        }
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }
      }
      setMessage({ text: data.error || 'Ошибка создания платежа', type: 'error' });
    } catch {
      setMessage({ text: 'Ошибка сети', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-medium">
        <ArrowLeft size={20} />
        Назад
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-xl space-y-8"
      >
        <h1 className="text-2xl font-black uppercase tracking-tight">
          {isProductPay ? 'Оплата товара' : 'Пополнение баланса'}
        </h1>
        {isProductPay && product && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/50 max-w-md">
            <Link to={`/products/${product.id}`} className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-[var(--muted)] flex items-center justify-center no-underline">
              {product.image ? (
                <img src={product.image.startsWith('http') || product.image.startsWith('/') ? product.image : `/uploads/${product.image}`} alt="" className="w-full h-full object-cover object-center" />
              ) : (
                <span className="text-muted-foreground text-[10px] font-bold uppercase text-center">Фото</span>
              )}
            </Link>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <Link to={`/products/${product.id}`} className="font-bold text-sm text-foreground line-clamp-2 no-underline hover:opacity-90" style={{ textDecoration: 'none' }}>
                {product.name}
              </Link>
              <span className="mt-2 inline-flex items-center justify-center rounded-xl px-4 py-2 w-fit text-sm font-black bg-primary text-white shadow-md">
                {product.price} ₽
              </span>
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {isProductPay ? `Сумма к оплате: ${amount} ₽` : `Минимальная сумма — ${minAmount} ₽`}
        </p>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Сумма (₽)</label>
          <input
            type="number"
            min={isProductPay ? amount : minAmount}
            step={1}
            readOnly={!!isProductPay}
            className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] text-2xl font-black outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary tabular-nums"
            value={amount}
            onChange={e => !isProductPay && setAmount(Math.max(minAmount, parseInt(e.target.value) || minAmount))}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Способ оплаты</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setMethod('sbp')}
              className={`relative p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                method === 'sbp' ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-[var(--border)] bg-[var(--background)] hover:border-primary/40'
              }`}
            >
              {method === 'sbp' && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <QrCode size={28} className={method === 'sbp' ? 'text-primary' : 'text-muted-foreground'} />
              <span className={`text-sm font-bold ${method === 'sbp' ? 'text-foreground' : 'text-muted-foreground'}`}>СБП</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('crypto')}
              className={`relative p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                method === 'crypto' ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-[var(--border)] bg-[var(--background)] hover:border-primary/40'
              }`}
            >
              {method === 'crypto' && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <Bitcoin size={28} className={method === 'crypto' ? 'text-amber-500' : 'text-muted-foreground'} />
              <span className={`text-sm font-bold ${method === 'crypto' ? 'text-foreground' : 'text-muted-foreground'}`}>Crypto</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`relative p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                method === 'card' ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-[var(--border)] bg-[var(--background)] hover:border-primary/40'
              }`}
            >
              {method === 'card' && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <CreditCard size={28} className={method === 'card' ? 'text-primary' : 'text-muted-foreground'} />
              <span className={`text-sm font-bold ${method === 'card' ? 'text-foreground' : 'text-muted-foreground'}`}>Карта</span>
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl font-bold text-center ${
            message.type === 'success' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleTopUp}
          disabled={loading}
          className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xl uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 disabled:opacity-50"
        >
          {loading ? 'Создание платежа...' : isProductPay ? `Оплатить ${amount} ₽` : `Пополнить на ${amount} ₽`}
        </button>
      </motion.div>
    </div>
  );
};
