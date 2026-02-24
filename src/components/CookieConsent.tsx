import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'cookie_consent_accepted';

export const CookieConsent: React.FC = () => {
  const [accepted, setAccepted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
      setAccepted(true);
    } catch (_) {}
  };

  if (accepted) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-[var(--card)] border-t border-[var(--border)] shadow-2xl">
      <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Мы используем файлы cookie для работы сайта и удобства. Продолжая пользоваться сайтом, вы соглашаетесь с{' '}
          <Link to="/privacy" className="text-primary underline hover:opacity-80">политикой конфиденциальности</Link> и использованием cookies.
        </p>
        <div className="flex gap-2 shrink-0">
          <Link
            to="/privacy"
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            Подробнее
          </Link>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  );
};
