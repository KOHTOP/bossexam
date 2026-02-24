import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CreditCard, QrCode, Bitcoin, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_MIN = 1;

export const TopUpPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [minAmount, setMinAmount] = useState(DEFAULT_MIN);
  const [amount, setAmount] = useState(DEFAULT_MIN);
  const [method, setMethod] = useState<'sbp' | 'crypto' | 'card'>('sbp');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/settings/min_topup_amount')
      .then(res => res.json())
      .then(data => {
        const n = Math.max(1, parseInt(String(data.value || ''), 10) || DEFAULT_MIN);
        setMinAmount(n);
        setAmount(prev => (prev < n ? n : prev));
      })
      .catch(() => {});
  }, []);

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
    if (amount < minAmount) {
      setMessage({ text: `Минимальная сумма пополнения — ${minAmount} ₽`, type: 'error' });
      return;
    }
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentMethod: method })
      });
      const data = await res.json();
      if (res.ok && data.redirect) {
        window.location.href = data.redirect;
        return;
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
        <h1 className="text-2xl font-black uppercase tracking-tight">Пополнение баланса</h1>
        <p className="text-sm text-muted-foreground">Минимальная сумма — {minAmount} ₽</p>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Сумма (₽)</label>
          <input
            type="number"
            min={minAmount}
            step={1}
            className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] text-2xl font-black outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary"
            value={amount}
            onChange={e => setAmount(Math.max(minAmount, parseInt(e.target.value) || minAmount))}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Способ оплаты</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setMethod('sbp')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                method === 'sbp' ? 'border-primary bg-primary/10' : 'border-[var(--border)] hover:border-primary/50'
              }`}
            >
              <QrCode size={32} className="text-primary" />
              <span className="text-sm font-bold">СБП</span>
            </button>
            <button
              onClick={() => setMethod('crypto')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                method === 'crypto' ? 'border-primary bg-primary/10' : 'border-[var(--border)] hover:border-primary/50'
              }`}
            >
              <Bitcoin size={32} className="text-amber-500" />
              <span className="text-sm font-bold">Crypto</span>
            </button>
            <button
              onClick={() => setMethod('card')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                method === 'card' ? 'border-primary bg-primary/10' : 'border-[var(--border)] hover:border-primary/50'
              }`}
            >
              <CreditCard size={32} className="text-primary" />
              <span className="text-sm font-bold">Карта</span>
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
          {loading ? 'Создание платежа...' : `Пополнить на ${amount} ₽`}
        </button>
      </motion.div>
    </div>
  );
};
