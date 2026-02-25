import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Key, Upload, CheckCircle2, ShoppingBag, ExternalLink, Calendar } from 'lucide-react';

interface Purchase {
  id: number;
  name: string;
  image?: string;
  description?: string;
  delivery_content?: string;
  purchased_at: string;
}

export const ProfilePage: React.FC = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({ display_name: '', avatar: '', telegram: '' });
  const [changePassword, setChangePassword] = useState({ new: '', confirm: '' });
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else if (user.role === 'admin' || user.role === 'superadmin') {
        navigate('/admin', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      setProfileData({
        display_name: user.display_name || '',
        avatar: user.avatar || '',
        telegram: user.telegram || ''
      });
      authFetch('/api/purchases')
        .then(res => res.ok ? res.json() : [])
        .then(setPurchases)
        .catch(() => setPurchases([]));
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    try {
      const res = await authFetch(`/api/admin/users/${user!.id}`, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        alert('Профиль обновлен. Пожалуйста, перезайдите для применения изменений.');
      } else {
        alert('Ошибка при обновлении профиля');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const handleUpdatePassword = async () => {
    if (changePassword.new !== changePassword.confirm) {
      return alert('Пароли не совпадают');
    }
    try {
      const res = await authFetch(`/api/admin/users/${user!.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: changePassword.new })
      });
      if (res.ok) {
        alert('Пароль успешно изменен');
        setChangePassword({ new: '', confirm: '' });
      } else {
        alert('Ошибка при смене пароля');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await authFetch('/api/admin/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setProfileData(prev => ({ ...prev, avatar: data.url }));
      } else {
        alert('Ошибка при загрузке аватарки');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  if (authLoading) return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold font-display tracking-tight">Личный кабинет</h1>
        <button
          onClick={logout}
          className="flex items-center gap-2 bg-[var(--muted)] text-foreground px-5 py-2.5 rounded-xl font-medium hover:bg-red-500 hover:text-white transition-all border border-[var(--border)] w-fit"
        >
          <LogOut size={20} />
          Выйти
        </button>
      </div>

      <div className="max-w-4xl space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-1/3 space-y-6">
            <div className="bg-[var(--card)] p-8 rounded-[40px] border border-[var(--border)] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                <div className="relative group/avatar">
                  <div className="w-32 h-32 rounded-[32px] bg-[var(--muted)] border-4 border-[var(--card)] shadow-2xl overflow-hidden flex items-center justify-center">
                    {profileData.avatar ? (
                      <img src={profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={64} className="text-muted-foreground" />
                    )}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-[32px]"
                  >
                    <Upload size={24} />
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black font-display uppercase tracking-tight">{user.username}</h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] uppercase font-black tracking-widest">
                      {user.role}
                    </span>
                    {!!user.is_verified && (
                      <div className="group relative">
                        <CheckCircle2 size={14} className="text-blue-500" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-black text-white text-[10px] rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 font-bold uppercase tracking-wider">
                          Подтверждён
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 w-full space-y-4 border-t border-[var(--border)]">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      <span>Баланс</span>
                    </div>
                    <div className="text-3xl font-black text-foreground">{user.balance || 0} ₽</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShoppingBag size={18} className="shrink-0 text-primary/80" />
                    <span>Покупок: <strong className="text-foreground">{purchases.length}</strong></span>
                  </div>
                  {user.created_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar size={18} className="shrink-0 text-primary/80" />
                      <span>Регистрация: <strong className="text-foreground">{new Date(user.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="md:w-2/3 space-y-8">
            <div className="bg-[var(--card)] p-10 rounded-[40px] border border-[var(--border)] shadow-xl space-y-8">
              <div className="flex items-center gap-4 text-xl font-black uppercase tracking-tight">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <User size={24} />
                </div>
                Настройки профиля
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Отображаемое имя</label>
                  <input
                    type="text"
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold"
                    value={profileData.display_name}
                    onChange={e => setProfileData({ ...profileData, display_name: e.target.value })}
                    placeholder="Ваш никнейм"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Telegram</label>
                  <input
                    type="text"
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold"
                    value={profileData.telegram}
                    onChange={e => setProfileData({ ...profileData, telegram: e.target.value })}
                    placeholder="@username"
                  />
                </div>
              </div>
              <button
                onClick={handleUpdateProfile}
                className="w-full bg-primary text-white py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 active:scale-[0.98]"
              >
                Сохранить изменения
              </button>
            </div>

            <div className="bg-[var(--card)] p-10 rounded-[40px] border border-[var(--border)] shadow-xl space-y-8">
              <div className="flex items-center gap-4 text-xl font-black uppercase tracking-tight">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Key size={24} />
                </div>
                Смена пароля
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Новый пароль</label>
                  <input
                    type="password"
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold"
                    value={changePassword.new}
                    onChange={e => setChangePassword({ ...changePassword, new: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Подтверждение</label>
                  <input
                    type="password"
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold"
                    value={changePassword.confirm}
                    onChange={e => setChangePassword({ ...changePassword, confirm: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button
                onClick={handleUpdatePassword}
                className="bg-[var(--muted)] text-foreground px-10 py-4 rounded-2xl font-bold hover:bg-[var(--border)] transition-all border border-[var(--border)] uppercase text-sm tracking-widest"
              >
                Обновить пароль
              </button>
            </div>
          </div>
        </div>
      </div>

      {purchases.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <ShoppingBag size={28} className="text-primary" />
            Мои покупки
          </h2>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="divide-y divide-[var(--border)]">
              {purchases.map((p) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-6 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-16 h-16 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0 overflow-hidden">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg uppercase tracking-tight truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(p.purchased_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="sm:w-64 flex-shrink-0">
                    {p.delivery_content ? (
                      <>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Ссылка / текст для получения</p>
                        {p.delivery_content.startsWith('http') ? (
                          <a
                            href={p.delivery_content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary font-bold hover:underline text-sm"
                          >
                            <ExternalLink size={14} />
                            Получить товар
                          </a>
                        ) : (
                          <p className="text-sm font-medium whitespace-pre-wrap break-words line-clamp-2">{p.delivery_content}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">—</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
