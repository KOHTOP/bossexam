import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, User, ShieldCheck, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

declare global {
  interface Window {
    handleTelegramAuth?: (user: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: number; hash: string }) => void;
  }
}

export const AuthPage: React.FC = () => {
  const { login, register, loginWithTelegram, user } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [telegramBotName, setTelegramBotName] = useState('');
  const telegramContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLogin) {
      fetch('/api/captcha').then(res => res.json()).then(data => setCaptchaText(data.captcha));
    }
  }, [isLogin]);

  const refreshCaptcha = () => {
    fetch('/api/captcha').then(res => res.json()).then(data => setCaptchaText(data.captcha));
  };

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then((data: { telegramBotName?: string }) => setTelegramBotName(data?.telegramBotName || ''));
  }, []);

  useEffect(() => {
    if (!telegramBotName || !loginWithTelegram) return;
    window.handleTelegramAuth = (tgUser) => {
      setError('');
      setLoading(true);
      loginWithTelegram(tgUser).then(() => navigate('/')).catch((err: Error) => {
        setError(err.message);
      }).finally(() => setLoading(false));
    };
    return () => { delete window.handleTelegramAuth; };
  }, [telegramBotName, loginWithTelegram, navigate]);

  useEffect(() => {
    if (!telegramBotName || !telegramContainerRef.current) return;
    const el = document.createElement('script');
    el.src = 'https://telegram.org/js/telegram-widget.js?22';
    el.setAttribute('data-telegram-login', telegramBotName);
    el.setAttribute('data-size', 'large');
    el.setAttribute('data-onauth', 'handleTelegramAuth');
    el.setAttribute('data-auth-url', '');
    el.async = true;
    telegramContainerRef.current.innerHTML = '';
    telegramContainerRef.current.appendChild(el);
    return () => { telegramContainerRef.current?.replaceChildren(); };
  }, [telegramBotName]);

  const getPasswordStrength = (pass: string): 0 | 1 | 2 | 3 => {
    if (pass.length === 0) return 0;
    if (pass.length < 8) return 1;
    if (pass.length < 12 || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) return 2;
    return 3;
  };

  useEffect(() => {
    if (user) {
      navigate(user.role === 'user' ? '/' : '/admin', { replace: true });
    }
  }, [user, navigate]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!isLogin && getPasswordStrength(password) === 1) {
      setError('Пароль слишком слабый. Используйте минимум 8 символов, цифры и заглавные буквы.');
      setLoading(false);
      return;
    }

    if (!isLogin && captcha.toUpperCase() !== captchaText.toUpperCase()) {
      setError('Неверный код с картинки');
      setLoading(false);
      refreshCaptcha();
      return;
    }

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
      if (!isLogin) refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-2xl space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-primary rotate-3 hover:rotate-0 transition-transform">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            {isLogin ? 'Авторизация' : 'Регистрация'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? 'Войдите в систему для продолжения работы' : 'Создайте аккаунт для комментирования'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2 ml-1">
              <User size={16} className="text-primary" /> Логин (Username)
            </label>
            <input
              type="text"
              className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Введите логин"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2 ml-1">
              <Lock size={16} className="text-primary" /> Пароль
            </label>
            <input
              type="password"
              className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {!isLogin && password.length > 0 && (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <div 
                      key={s}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-all",
                        getPasswordStrength(password) >= s 
                          ? (s === 1 ? "bg-red-500" : s === 2 ? "bg-yellow-500" : "bg-green-500")
                          : "bg-[var(--muted)]"
                      )}
                    />
                  ))}
                </div>
                <p className={cn(
                  "text-xs font-medium",
                  getPasswordStrength(password) === 1 ? "text-red-500" : getPasswordStrength(password) === 2 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
                )}>
                  {getPasswordStrength(password) === 1 ? 'Слабый пароль — регистрация недоступна' : getPasswordStrength(password) === 2 ? 'Средний пароль' : 'Надёжный пароль'}
                </p>
              </div>
            )}
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2 ml-1">
                Код с картинки
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 bg-[var(--muted)] p-2 rounded-xl border border-[var(--border)]">
                  <div className="px-4 py-2 bg-white/5 rounded-lg font-mono font-black tracking-[0.3em] text-lg select-none italic line-through decoration-primary/50 skew-x-12">
                    {captchaText}
                  </div>
                  <button 
                    type="button" 
                    onClick={refreshCaptcha}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
                <input
                  type="text"
                  className="w-24 p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-center font-bold uppercase"
                  placeholder="Код"
                  value={captcha}
                  onChange={e => setCaptcha(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>
          )}
          
          {error && (
            <motion.p 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || (!isLogin && getPasswordStrength(password) === 1)}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
          >
            {loading ? (isLogin ? 'Вход...' : 'Регистрация...') : (isLogin ? 'Войти в систему' : 'Зарегистрироваться')}
          </button>

          {telegramBotName && (
            <>
              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">или</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">Войти через Telegram</p>
                <div ref={telegramContainerRef} className="min-h-[44px] flex items-center justify-center" />
              </div>
            </>
          )}
        </form>

        <div className="text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-primary font-bold hover:underline"
          >
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
