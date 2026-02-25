import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Send, User, ShoppingBag, Package, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';
import { useDocumentHead } from '../hooks/useDocumentHead';

interface Review {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  content: string;
  created_at: string;
  last_purchase_name: string | null;
  purchase_count: number;
}

export const ReviewsPage: React.FC = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useDocumentHead('Отзывы', 'Отзывы покупателей о работах и сервисе BossExam');

  const fetchReviews = () => {
    fetch('/api/reviews')
      .then(res => res.ok ? res.json() : [])
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (user.is_blocked) return;
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setContent('');
        setToast(data.message || 'Отзыв отправлен на модерацию');
        setTimeout(() => setToast(''), 3000);
      } else {
        setToast(data.error || 'Ошибка');
        setTimeout(() => setToast(''), 3000);
      }
    } catch {
      setToast('Ошибка сети');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <MessageSquare size={28} />
          </div>
          Отзывы
        </h1>
      </div>

      {user && !user.is_blocked && (
        <div className="bg-[var(--card)] p-8 rounded-[40px] border border-[var(--border)] shadow-xl">
          <h2 className="text-xl font-bold mb-4">Оставить отзыв</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Отзыв будет опубликован после одобрения модератором. Укажите последнюю купленную работу и общее количество покупок в тексте или мы подставим эти данные автоматически.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Напишите ваш отзыв..."
              className="w-full min-h-[120px] p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium resize-y"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              <Send size={20} />
              {submitting ? 'Отправка...' : 'Отправить на модерацию'}
            </button>
          </form>
        </div>
      )}

      {!user && (
        <p className="text-muted-foreground">
          <Link to="/auth" className="text-primary font-medium hover:underline">Войдите</Link>, чтобы оставить отзыв.
        </p>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--card)] border border-[var(--border)] px-6 py-3 rounded-2xl shadow-xl z-50 font-medium">
          {toast}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Одобренные отзывы</h2>
          <button
            onClick={() => { setLoading(true); fetchReviews(); }}
            className="p-2 rounded-xl hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors"
            title="Обновить"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">Загрузка...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Пока нет отзывов.</div>
        ) : (
          <div className="space-y-6">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="bg-[var(--card)] p-6 rounded-[32px] border border-[var(--border)] shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <Link
                    to={`/author/${r.username}`}
                    className="flex items-center gap-3 shrink-0 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] overflow-hidden flex items-center justify-center border-2 border-[var(--border)] group-hover:border-primary transition-colors">
                      {r.avatar ? (
                        <img src={r.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold group-hover:text-primary transition-colors">
                        {r.display_name || r.username}
                      </span>
                      <span className="text-muted-foreground text-sm block">@{r.username}</span>
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0 space-y-3">
                    <p className="text-foreground whitespace-pre-wrap">{r.content}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {r.last_purchase_name && (
                        <span className="flex items-center gap-1.5">
                          <Package size={16} />
                          Последняя покупка: {r.last_purchase_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <ShoppingBag size={16} />
                        Всего покупок: {r.purchase_count}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
