import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, MessageSquare, User, ShoppingBag, Wallet, CheckCheck, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';
import { formatRelativeTime } from '../lib/relativeTime';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'market', label: 'Маркет' },
  { key: 'other', label: 'Комментарии и пользователи' },
];

const typeConfig: Record<
  NotificationType,
  { icon: React.ReactNode; label: string; bg: string; border: string; iconBg: string }
> = {
  comment: {
    icon: <MessageSquare size={20} />,
    label: 'Комментарий',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    iconBg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  },
  user: {
    icon: <User size={20} />,
    label: 'Пользователь',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
  purchase: {
    icon: <ShoppingBag size={20} />,
    label: 'Покупка',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  },
  topup: {
    icon: <Wallet size={20} />,
    label: 'Пополнение',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    iconBg: 'bg-violet-500/20 text-violet-600 dark:text-violet-400',
  },
};

function NotificationDetailModal({
  notif,
  onClose,
  onMarkRead,
}: {
  notif: Notification;
  onClose: () => void;
  onMarkRead: (id: number) => void;
}) {
  const cfg = typeConfig[notif.type];
  React.useEffect(() => {
    if (!notif.read) onMarkRead(notif.id);
  }, [notif.id, notif.read, onMarkRead]);

  let payloadBlock: React.ReactNode = null;
  if (notif.type === 'purchase' && notif.payload) {
    try {
      const p = JSON.parse(notif.payload) as PurchasePayload;
      payloadBlock = (
        <div className={cn('rounded-2xl border p-4 space-y-3', cfg.border, cfg.bg)}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Детали</h4>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Кто</dt><dd className="font-medium">{p.displayName || p.username || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Товары</dt><dd className="font-medium">{Array.isArray(p.productNames) && p.productNames.length ? p.productNames.join(', ') : '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Сумма</dt><dd className="font-bold">{p.total != null ? `${p.total} ₽` : '—'}</dd></div>
            {p.balanceAfter != null && (
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Баланс после</dt><dd>{p.balanceAfter} ₽</dd></div>
            )}
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Когда</dt><dd>{p.purchasedAt ? new Date(p.purchasedAt).toLocaleString('ru-RU') : '—'}</dd></div>
          </dl>
        </div>
      );
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={cn('bg-[var(--card)] rounded-3xl border-2 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col', cfg.border)}
        onClick={e => e.stopPropagation()}
      >
        <div className={cn('px-6 py-5 flex items-center justify-between', cfg.bg)}>
          <div className="flex items-center gap-3">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', cfg.iconBg)}>
              {cfg.icon}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cfg.label}</p>
              <h2 className="text-lg font-bold text-foreground">{notif.title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-black/10 text-foreground transition-colors">
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4 notif-panel-scroll">
          <p className="text-foreground leading-relaxed">{notif.body}</p>
          <p className="text-xs text-muted-foreground">{new Date(notif.created_at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {payloadBlock}
        </div>
        <div className="p-6 border-t border-[var(--border)] flex gap-3 justify-end bg-[var(--muted)]/20">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] font-medium text-foreground transition-colors">
            Закрыть
          </button>
          {notif.link && (
            <Link to={notif.link} onClick={onClose} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors">
              Перейти
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}

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
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: 1 } : n)));
    });
  };

  const markAllRead = () => {
    authFetch('/api/notifications/read-all', { method: 'PATCH' }).then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!user) return null;
  if (!isAdmin) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight flex items-center gap-3">
            <span className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
              <Bell size={28} />
            </span>
            Оповещения
          </h1>
          <p className="text-muted-foreground mt-2">Комментарии, покупки и пополнения баланса</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] font-medium text-foreground transition-colors w-fit"
          >
            <CheckCheck size={18} />
            Прочитать все
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              tab === key
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'bg-[var(--muted)]/50 text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground border border-transparent hover:border-[var(--border)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-sm font-medium">Загрузка уведомлений...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-center">
            <span className="w-20 h-20 rounded-2xl bg-[var(--muted)] flex items-center justify-center text-muted-foreground">
              <Inbox size={40} />
            </span>
            <div>
              <p className="font-bold text-foreground">Нет уведомлений</p>
              <p className="text-sm text-muted-foreground mt-1">Здесь появятся комментарии, покупки и пополнения</p>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto notif-panel-scroll">
            <ul className="divide-y divide-[var(--border)]">
            <AnimatePresence initial={false}>
              {notifications.map((n, i) => {
                const cfg = typeConfig[n.type];
                return (
                  <motion.li
                    key={n.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn('border-l-4', !n.read ? cfg.border : 'border-transparent')}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) markAsRead(n.id);
                        setDetailNotif(n);
                      }}
                      className={cn(
                        'w-full flex items-start gap-4 p-5 hover:bg-[var(--muted)]/30 transition-colors text-left',
                        !n.read && cfg.bg
                      )}
                    >
                      <div className={cn('shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center', cfg.iconBg)}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-foreground">{n.title}</div>
                        <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                        <div className="text-xs text-muted-foreground/80 mt-2">
                          {formatRelativeTime(n.created_at)}
                        </div>
                      </div>
                      <ChevronRight size={20} className="shrink-0 text-muted-foreground mt-1" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          </div>
        )}
      </div>

      <AnimatePresence>
        {detailNotif && (
          <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <NotificationDetailModal
              notif={detailNotif}
              onClose={() => setDetailNotif(null)}
              onMarkRead={markAsRead}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
