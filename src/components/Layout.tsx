import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Sun, Moon, Menu, X, Plus, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn, Article } from '../lib/utils';
import { LoadingScreen } from './LoadingScreen';
import { CookieConsent } from './CookieConsent';
import { useDocumentHead, getDefaultSEO } from '../hooks/useDocumentHead';

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

  useEffect(() => {
    if (!isAdmin) return;
    const fetchUnread = () => {
      fetch('/api/notifications/unread-count')
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
    fetch('/api/notifications?category=all')
      .then(res => res.ok ? res.json() : [])
      .then(data => setNotifList(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setNotifList([]));
  }, [isAdmin, notifDropdownOpen]);

  const defaultSEO = getDefaultSEO(location.pathname);
  useDocumentHead(defaultSEO.title, defaultSEO.description);

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
                    <div className="absolute right-0 top-full mt-1 w-[320px] max-h-[400px] overflow-auto py-2 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xl z-50">
                      <div className="px-3 pb-2 border-b border-[var(--border)] flex items-center justify-between">
                        <span className="text-sm font-bold">Оповещения</span>
                      </div>
                      {notifList.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-muted-foreground text-center">Нет новых оповещений</div>
                      ) : (
                        <ul className="divide-y divide-[var(--border)]">
                          {notifList.map((n) => (
                            <li key={n.id}>
                              <button
                                type="button"
                                onClick={() => { setNotifDetail(n); setNotifDropdownOpen(false); }}
                                className={cn(
                                  "w-full block px-4 py-3 text-left hover:bg-[var(--muted)] transition-colors",
                                  !n.read && "bg-primary/5"
                                )}
                              >
                                <div className="font-medium text-sm text-foreground">{n.title}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                                <div className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString('ru-RU')}</div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        to="/notifications"
                        onClick={() => setNotifDropdownOpen(false)}
                        className="block px-4 py-3 text-sm font-bold text-primary hover:bg-[var(--muted)] transition-colors border-t border-[var(--border)]"
                      >
                        Перейти на страницу уведомлений
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
            <div className="pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-muted-foreground/60">
                boss-exam.com © {new Date().getFullYear()}. Все права защищены.
              </p>
            </div>
          </div>
        </aside>
      </div>
      {notifDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setNotifDetail(null)}>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl max-w-lg w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{notifDetail.title}</h2>
              <button type="button" onClick={() => setNotifDetail(null)} className="p-2 rounded-lg hover:bg-[var(--muted)] text-muted-foreground">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground">{notifDetail.body}</p>
              <p className="text-xs text-muted-foreground">{new Date(notifDetail.created_at).toLocaleString('ru-RU')}</p>
              {notifDetail.type === 'purchase' && notifDetail.payload && (() => {
                try {
                  const p = JSON.parse(notifDetail.payload as string) as { displayName?: string; username?: string; productNames?: string[]; total?: number; balanceAfter?: number; purchasedAt?: string };
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
                } catch { return null; }
              })()}
            </div>
            <div className="p-6 border-t border-[var(--border)] flex gap-3 justify-end">
              <button type="button" onClick={() => setNotifDetail(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] font-medium text-foreground">Закрыть</button>
              {notifDetail.link && (
                <Link to={notifDetail.link} onClick={() => setNotifDetail(null)} className="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90">Перейти</Link>
              )}
            </div>
          </div>
        </div>
      )}
      <CookieConsent />
    </div>
  );
};
