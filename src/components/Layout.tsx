import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Sun, Moon, Menu, X, Plus, ChevronDown, Bell, MessageSquare, ShoppingBag, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authFetch } from '../lib/auth';
import { cn, Article } from '../lib/utils';
import { formatRelativeTime } from '../lib/relativeTime';
import { LoadingScreen } from './LoadingScreen';
import { CookieConsent } from './CookieConsent';
import { useDocumentHead, getDefaultSEO } from '../hooks/useDocumentHead';

const notifTypeIcon: Record<string, React.ReactNode> = {
  comment: <MessageSquare size={18} />,
  user: <User size={18} />,
  purchase: <ShoppingBag size={18} />,
  topup: <Wallet size={18} />,
};
const notifTypeStyle: Record<string, string> = {
  comment: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  user: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  purchase: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  topup: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifList, setNotifList] = useState<{ id: number; type: string; title: string; body: string; link: string | null; read: number; created_at: string; payload?: string | null }[]>([]);
  const [notifDetail, setNotifDetail] = useState<typeof notifList[0] | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isAdminPage = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  useEffect(() => {
    if (!isAdmin) return;
    const fetchUnread = () => {
      authFetch('/api/notifications/unread-count')
        .then(res => res.ok ? res.json() : { count: 0 })
        .then(data => setNotifUnreadCount(data?.count ?? 0))
        .catch(() => setNotifUnreadCount(0));
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 60000);
    return () => clearInterval(t);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !notifDropdownOpen) return;
    authFetch('/api/notifications?category=all')
      .then(res => res.ok ? res.json() : [])
      .then(data => setNotifList(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setNotifList([]));
    if (notifUnreadCount > 0) {
      authFetch('/api/notifications/read-all', { method: 'PATCH' }).then(() => setNotifUnreadCount(0));
    }
  }, [isAdmin, notifDropdownOpen]);

  const defaultSEO = getDefaultSEO(location.pathname);
  useDocumentHead(defaultSEO.title, defaultSEO.description, undefined, defaultSEO.noindex);

  useEffect(() => {
    const base = window.location.origin;
    const data = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'BossExam',
          url: base,
          description: 'База статей и материалов для подготовки к экзаменам. Учебные материалы и товары для студентов.',
        },
        {
          '@type': 'WebSite',
          name: 'BossExam',
          url: base,
          description: 'Статьи и материалы для экзаменов',
          publisher: { '@type': 'Organization', name: 'BossExam', url: base },
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${base}/?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    };
    let el = document.getElementById('ld-json-site') as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = 'ld-json-site';
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }, []);

  useEffect(() => {
    const fetchRecent = () => {
      fetch('/api/articles')
        .then(res => res.json())
        .then(data => setRecentArticles(data.slice(0, 5)))
        .catch(err => console.error('Failed to fetch recent articles:', err));
    };

    fetchRecent();
    const interval = setInterval(fetchRecent, 30000); // Poll every 30s
    
    // Only show loading screen once per session
    const hasLoaded = sessionStorage.getItem('hasLoaded');
    if (hasLoaded) {
      setIsFirstLoad(false);
    } else {
      sessionStorage.setItem('hasLoaded', 'true');
    }

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      {isFirstLoad && <LoadingScreen />}
      
      {user?.is_blocked && (
        <div className="bg-red-600 text-white py-4 px-6 text-center font-bold shadow-lg animate-pulse z-[60]">
          Ваша учетная запись была заблокирована администратором. Причина: {user.block_reason || 'Не указана'}
        </div>
      )}
      
      {!isAdminPage && (
      <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
              aria-label="Меню"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Link to="/" className="flex items-center gap-2 group">
              <img src="/icon.png" alt="" className="h-9 w-9 object-contain rounded-lg group-hover:scale-110 transition-transform shadow-lg shadow-primary/20" aria-hidden />
              <span className="text-xl font-bold tracking-tight font-display">BossExam</span>
            </Link>
          </div>

          <nav className={cn(
            "absolute md:relative top-16 md:top-0 left-0 right-0 md:flex items-center gap-6 md:gap-6 bg-[var(--background)] md:bg-transparent border-b md:border-b-0 border-[var(--border)] md:border-none py-4 md:py-0 px-4 md:px-0",
            mobileMenuOpen ? "flex flex-col" : "hidden md:flex"
          )}>
            <Link 
              to="/" 
              onClick={() => { setMobileMenuOpen(false); setUserDropdownOpen(false); }}
              className={cn(
                "py-2 md:py-0 text-sm font-medium transition-colors hover:text-primary",
                location.pathname === "/" ? "text-primary" : "text-muted-foreground"
              )}
            >
              Главная
            </Link>
            <Link 
              to="/products"
              onClick={() => { setMobileMenuOpen(false); setUserDropdownOpen(false); }}
              className={cn(
                "py-2 md:py-0 text-sm font-medium transition-colors hover:text-primary",
                location.pathname.startsWith("/products") ? "text-primary" : "text-muted-foreground"
              )}
            >
              Товары
            </Link>
            <Link 
              to="/reviews"
              onClick={() => { setMobileMenuOpen(false); setUserDropdownOpen(false); }}
              className={cn(
                "py-2 md:py-0 text-sm font-medium transition-colors hover:text-primary",
                location.pathname === "/reviews" ? "text-primary" : "text-muted-foreground"
              )}
            >
              Отзывы
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors text-muted-foreground hover:text-primary"
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {isAdmin && (
              <div className="relative hidden md:block">
                <button
                  onClick={() => { setNotifDropdownOpen(!notifDropdownOpen); setUserDropdownOpen(false); }}
                  className="relative p-2 rounded-full hover:bg-[var(--muted)] transition-colors text-muted-foreground hover:text-primary"
                  title="Оповещения"
                >
                  <Bell size={20} />
                  {notifUnreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                      {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                    </span>
                  )}
                </button>
                {notifDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[420px] overflow-hidden flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl z-50">
                      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/20 flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">Оповещения</span>
                        {notifUnreadCount > 0 && (
                          <span className="text-xs font-bold text-primary">{notifUnreadCount} новых</span>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1 min-h-0 notif-panel-scroll">
                        {notifList.length === 0 ? (
                          <div className="px-4 py-8 text-sm text-muted-foreground text-center">Нет оповещений</div>
                        ) : (
                          <ul className="divide-y divide-[var(--border)]">
                            {notifList.map((n) => (
                              <li key={n.id}>
                                <button
                                  type="button"
                                  onClick={() => { setNotifDetail(n); setNotifDropdownOpen(false); }}
                                  className={cn(
                                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--muted)]/30 transition-colors",
                                    !n.read && "bg-primary/5"
                                  )}
                                >
                                  <span className={cn("shrink-0 w-9 h-9 rounded-xl flex items-center justify-center", notifTypeStyle[n.type] || "bg-[var(--muted)] text-muted-foreground")}>
                                    {notifTypeIcon[n.type] ?? <Bell size={18} />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-sm text-foreground">{n.title}</div>
                                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                                    <div className="text-[11px] text-muted-foreground/80 mt-1">{formatRelativeTime(n.created_at)}</div>
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Link
                        to="/notifications"
                        onClick={() => setNotifDropdownOpen(false)}
                        className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-primary hover:bg-[var(--muted)]/50 transition-colors border-t border-[var(--border)] bg-[var(--muted)]/20"
                      >
                        Все уведомления
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
            {!user ? (
              <Link 
                to="/auth" 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors text-muted-foreground hover:text-primary"
                title="Вход"
              >
                <User size={20} />
              </Link>
            ) : (
              <div className="relative">
                <button
                  onClick={() => { setUserDropdownOpen(!userDropdownOpen); setNotifDropdownOpen(false); }}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-[var(--muted)] text-foreground text-sm font-bold border border-[var(--border)] hover:bg-[var(--border)] transition-all"
                  title="Профиль и баланс"
                >
                  <User size={20} className="text-muted-foreground" />
                  <span className="hidden sm:inline">{user.balance ?? 0} ₽</span>
                  <span className="hidden sm:inline text-muted-foreground">·</span>
                  <span className="hidden sm:inline">{user.role === 'admin' || user.role === 'superadmin' ? 'Админка' : 'Профиль'}</span>
                  <ChevronDown size={16} className={cn("transition-transform", userDropdownOpen && "rotate-180")} />
                </button>
                {userDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 py-2 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl z-50 min-w-[220px]">
                      {/* Профиль / Админка */}
                      <Link
                        to={user.role === 'admin' || user.role === 'superadmin' ? '/admin' : '/profile'}
                        onClick={() => { setUserDropdownOpen(false); setMobileMenuOpen(false); }}
                        className="block px-4 py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                      >
                        {user.role === 'admin' || user.role === 'superadmin' ? 'Профиль администратора' : 'Профиль'}
                      </Link>

                      {/* Уведомления (для админов, на телефонах в меню) */}
                      {isAdmin && (
                        <Link
                          to="/notifications"
                          onClick={() => { setUserDropdownOpen(false); setMobileMenuOpen(false); }}
                          className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Bell size={18} />
                            Оповещения
                          </span>
                          {notifUnreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                              {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                            </span>
                          )}
                        </Link>
                      )}

                      {/* Баланс */}
                      <div className="px-4 py-3 text-sm border-y border-[var(--border)] flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                            Баланс
                          </div>
                          <div className="text-sm font-black">
                            {user.balance ?? 0} ₽
                          </div>
                        </div>
                        <Link
                          to="/topup"
                          onClick={() => { setUserDropdownOpen(false); setMobileMenuOpen(false); }}
                          className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                          title="Пополнить баланс"
                        >
                          <Plus size={16} />
                        </Link>
                      </div>

                      {/* Остальные пункты меню */}
                      <Link
                        to="/topup"
                        onClick={() => { setUserDropdownOpen(false); setMobileMenuOpen(false); }}
                        className="flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                      >
                        <Plus size={16} /> Пополнить баланс
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      )}

      {isAdminPage ? (
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      ) : (
        <div className="flex-1 container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-8">
            {children}
          </main>
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="h-12 bg-primary flex items-center px-6">
                <h3 className="text-white font-bold">Последние обновления</h3>
              </div>
              <div className="p-4 divide-y divide-[var(--border)]">
                {recentArticles.length > 0 ? recentArticles.map((article) => (
                  <Link 
                    key={article.id} 
                    to={`/article/${article.slug}`}
                    className="block py-4 group"
                  >
                    <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(article.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                )) : (
                  <p className="py-4 text-sm text-muted-foreground text-center italic">Нет новых обновлений</p>
                )}
              </div>
            </div>
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 shadow-sm space-y-4">
              <Link to="/privacy" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Политика конфиденциальности
              </Link>
              <Link to="/terms" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Пользовательское соглашение
              </Link>
              <Link to="/contacts" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Контакты
              </Link>
              <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-muted-foreground/60">
                  BossExam © {new Date().getFullYear()}. Все права защищены.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
      {notifDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setNotifDetail(null)}>
          <div
            className={cn(
              "bg-[var(--card)] rounded-3xl border-2 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col",
              notifDetail.type === 'comment' && "border-blue-500/30",
              notifDetail.type === 'user' && "border-emerald-500/30",
              notifDetail.type === 'purchase' && "border-amber-500/30",
              notifDetail.type === 'topup' && "border-violet-500/30"
            )}
            onClick={e => e.stopPropagation()}
          >
            <div className={cn(
              "px-6 py-5 flex items-center justify-between",
              notifDetail.type === 'comment' && "bg-blue-500/10",
              notifDetail.type === 'user' && "bg-emerald-500/10",
              notifDetail.type === 'purchase' && "bg-amber-500/10",
              notifDetail.type === 'topup' && "bg-violet-500/10"
            )}>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  notifTypeStyle[notifDetail.type] || "bg-[var(--muted)]"
                )}>
                  {notifTypeIcon[notifDetail.type] ?? <Bell size={20} />}
                </span>
                <h2 className="text-lg font-bold text-foreground">{notifDetail.title}</h2>
              </div>
              <button type="button" onClick={() => setNotifDetail(null)} className="p-2 rounded-xl hover:bg-black/10 text-foreground">×</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-foreground leading-relaxed">{notifDetail.body}</p>
              <p className="text-xs text-muted-foreground">{new Date(notifDetail.created_at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              {notifDetail.type === 'purchase' && notifDetail.payload && (() => {
                try {
                  const p = JSON.parse(notifDetail.payload as string) as { displayName?: string; username?: string; productNames?: string[]; total?: number; balanceAfter?: number; purchasedAt?: string };
                  return (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Детали</h4>
                      <dl className="grid gap-2 text-sm">
                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Кто</dt><dd className="font-medium">{p.displayName || p.username || '—'}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Товары</dt><dd className="font-medium">{Array.isArray(p.productNames) && p.productNames.length ? p.productNames.join(', ') : '—'}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Сумма</dt><dd className="font-bold">{p.total != null ? `${p.total} ₽` : '—'}</dd></div>
                        {p.balanceAfter != null && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Баланс после</dt><dd>{p.balanceAfter} ₽</dd></div>}
                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Когда</dt><dd>{p.purchasedAt ? new Date(p.purchasedAt).toLocaleString('ru-RU') : '—'}</dd></div>
                      </dl>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
            <div className="p-6 border-t border-[var(--border)] flex gap-3 justify-end bg-[var(--muted)]/20">
              <button type="button" onClick={() => setNotifDetail(null)} className="px-5 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] font-medium text-foreground">Закрыть</button>
              {notifDetail.link && (
                <Link to={notifDetail.link} onClick={() => setNotifDetail(null)} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90">Перейти</Link>
              )}
            </div>
          </div>
        </div>
      )}
      <CookieConsent />
    </div>
  );
};
