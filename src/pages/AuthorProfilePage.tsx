import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Send, CheckCircle2, ChevronLeft, BookOpen, ShoppingBag, Calendar } from 'lucide-react';
import { Article } from '../lib/utils';
import { useDocumentHead } from '../hooks/useDocumentHead';

interface Author {
  username: string;
  display_name: string;
  avatar: string;
  telegram: string;
  is_verified: boolean;
  purchase_count?: number;
  created_at?: string | null;
}

export const AuthorProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [author, setAuthor] = useState<Author | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [authorRes, articlesRes] = await Promise.all([
          fetch(`/api/authors/${username}`),
          fetch('/api/articles')
        ]);
        
        if (authorRes.ok) {
          const authorData = await authorRes.json();
          setAuthor(authorData);
        }
        
        if (articlesRes.ok) {
          const articlesData = await articlesRes.json();
          // Filter articles by author name (assuming author name in article matches username or display_name)
          // In a real app, we'd use author_id, but here we use author name string.
          // Let's filter by author name matching either username or display_name
          setArticles(articlesData.filter((a: Article) => 
            a.author.toLowerCase() === username?.toLowerCase()
          ));
        }
      } catch (err) {
        console.error('Failed to fetch author data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username]);

  useDocumentHead(author?.display_name || author?.username || 'Автор', author ? `Статьи и материалы автора ${author.display_name || author.username} на BossExam` : undefined);

  if (loading) return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  if (!author) return <div className="text-center py-24">Автор не найден</div>;

  return (
    <div className="space-y-8">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronLeft size={16} />
        Назад
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--card)] p-8 md:p-12 rounded-[40px] border border-[var(--border)] shadow-xl relative overflow-hidden"
      >
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-[32px] bg-[var(--muted)] border-4 border-[var(--card)] shadow-2xl overflow-hidden flex items-center justify-center">
              {author.avatar ? (
                <img src={author.avatar} alt={author.display_name} className="w-full h-full object-cover" />
              ) : (
                <User size={64} className="text-muted-foreground" />
              )}
            </div>
            {!!author.is_verified && (
              <div className="absolute -bottom-2 -right-2 group">
                <div className="text-blue-500 drop-shadow-lg">
                  <CheckCircle2 size={32} fill="white" />
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-black text-white text-[10px] rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 font-bold uppercase tracking-wider">
                  Этот пользователь является администратором сайта
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                </div>
              </div>
            )}
          </div>

          <div className="text-center md:text-left space-y-4 flex-1">
            <div className="space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <h1 className="text-4xl md:text-5xl font-black font-display tracking-tight uppercase">
                  {author.display_name || author.username}
                </h1>
                {!!author.is_verified && (
                  <div className="group relative hidden md:block">
                    <CheckCircle2 size={28} className="text-blue-500" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-black text-white text-[10px] rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 font-bold uppercase tracking-wider">
                      Этот пользователь является администратором сайта
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground font-mono text-sm tracking-widest uppercase opacity-60">
                @{author.username}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ShoppingBag size={18} className="text-primary/80" />
                Покупок: <strong className="text-foreground">{author.purchase_count ?? 0}</strong>
              </span>
              {author.created_at && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar size={18} className="text-primary/80" />
                  Регистрация: <strong className="text-foreground">{new Date(author.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                </span>
              )}
            </div>
            {author.telegram && (
              <a 
                href={author.telegram.startsWith('http') ? author.telegram : `https://t.me/${author.telegram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 bg-[#0088cc] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#0088cc]/30"
              >
                <Send size={20} />
                Telegram
              </a>
            )}
          </div>
        </div>
      </motion.div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold font-display flex items-center gap-2">
          <BookOpen size={24} className="text-primary" />
          Статьи автора ({articles.length})
        </h2>
        
        <div className="grid gap-4">
          {articles.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/article/${article.slug}`}
                className="group flex items-center justify-between p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-primary hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">
                      {article.title}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                      <span className="px-2 py-0.5 rounded bg-[var(--muted)] font-bold text-[10px] uppercase">
                        {article.category}
                      </span>
                      • {new Date(article.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
