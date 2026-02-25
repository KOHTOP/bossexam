import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, MessageSquare, User, ShoppingBag, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';

type NotificationType = 'comment' | 'user' | 'purchase' | 'topup';

interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: number;
  created_at: string;
  payload?: string | null;
}

interface PurchasePayload {
  userId?: number;
  username?: string;
  displayName?: string;
  total?: number;
  balanceAfter?: number;
  productNames?: string[];
  purchasedAt?: string;
}

type Tab = 'all' | 'market' | 'other';

const typeIcon: Record<NotificationType, React.ReactNode> = {
  comment: <MessageSquare size={18} />,
  user: <User size={18} />,
  purchase: <ShoppingBag size={18} />,
  topup: <Wallet size={18} />,
};

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [detailNotif, setDetailNotif] = useState<Notification | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchNotifications();
  }, [user, isAdmin, navigate, tab]);

  const fetchNotifications = () => {
    setLoading(true);
    authFetch(`/api/notifications?category=${tab}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  const markAsRead = (id: number) => {
    authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).then(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    });
  };

  const markAllRead = () => {
    authFetch('/api/notifications/read-all', { method: 'PATCH' }).then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    });
  };

  if (!user) return null;
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black font-display flex items-center gap-2">
          <Bell size={28} className="text-primary" />
          Оповещения
        </h1>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllRead}
            className="text-sm font-medium text-primary hover:underline"
          >
            Отметить все прочитанными
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)] w-fit">
        {([
          { key: 'all' as Tab, label: 'Все' },
          { key: 'market' as Tab, label: 'Маркет' },
          { key: 'other' as Tab, label: 'Остальные' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === key
                ? 'bg-[var(--card)] text-primary shadow-sm border border-[var(--border)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Загрузка...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Нет новых оповещений.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markAsRead(n.id);
                    setDetailNotif(n);
                  }}
                  className={`w-full flex items-start gap-3 p-4 hover:bg-[var(--muted)]/30 transition-colors text-left ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center text-primary">
                    {typeIcon[n.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-foreground">{n.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      {new Date(n.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detailNotif && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetailNotif(null)}>
          <div
            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl max-w-lg w-full max-h-[85vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{detailNotif.title}</h2>
              <button type="button" onClick={() => setDetailNotif(null)} className="p-2 rounded-lg hover:bg-[var(--muted)] text-muted-foreground">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground">{detailNotif.body}</p>
              <p className="text-xs text-muted-foreground">{new Date(detailNotif.created_at).toLocaleString('ru-RU')}</p>
              {detailNotif.type === 'purchase' && detailNotif.payload && (() => {
                try {
                  const p = JSON.parse(detailNotif.payload) as PurchasePayload;
                  return (
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-[var(--border)]">
                          <tr><td className="px-4 py-2 font-bold text-muted-foreground w-36">Кто</td><td className="px-4 py-2 text-foreground">{p.displayName || p.username || '—'}</td></tr>
                          <tr><td className="px-4 py-2 font-bold text-muted-foreground">Что купил</td><td className="px-4 py-2 text-foreground">{Array.isArray(p.productNames) && p.productNames.length ? p.productNames.join(', ') : '—'}</td></tr>
                          <tr><td className="px-4 py-2 font-bold text-muted-foreground">Сумма</td><td className="px-4 py-2 text-foreground">{p.total != null ? `${p.total} ₽` : '—'}</td></tr>
                          <tr><td className="px-4 py-2 font-bold text-muted-foreground">Баланс после</td><td className="px-4 py-2 text-foreground">{p.balanceAfter != null ? `${p.balanceAfter} ₽` : '—'}</td></tr>
                          <tr><td className="px-4 py-2 font-bold text-muted-foreground">Когда</td><td className="px-4 py-2 text-foreground">{p.purchasedAt ? new Date(p.purchasedAt).toLocaleString('ru-RU') : '—'}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}
            </div>
            <div className="p-6 border-t border-[var(--border)] flex gap-3 justify-end">
              <button type="button" onClick={() => setDetailNotif(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] font-medium text-foreground">
                Закрыть
              </button>
              {detailNotif.link && (
                <Link to={detailNotif.link} onClick={() => setDetailNotif(null)} className="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90">
                  Перейти
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
