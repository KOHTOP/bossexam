import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Article } from '../lib/utils';
import { Search, ChevronRight, BookOpen, User, Eye } from 'lucide-react';
import { motion } from 'motion/react';

export const HomePage: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/articles')
      .then(res => res.json())
      .then(data => {
        setArticles(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch articles:', err);
        setLoading(false);
      });
  }, []);

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );
  const pinnedArticles = filteredArticles.filter(a => a.is_pinned);
  const restArticles = filteredArticles.filter(a => !a.is_pinned);

  const INITIAL_VISIBLE = 10;
  const LOAD_MORE_STEP = 10;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const visibleRest = restArticles.slice(0, visibleCount);
  const hasMoreRest = restArticles.length > visibleCount;

  const renderArticleRow = (article: Article, isPinned?: boolean) => (
    <Link
      key={article.id}
      to={`/article/${article.slug}`}
      className={`group flex items-center gap-4 p-5 rounded-2xl border bg-[var(--card)] hover:border-primary/50 hover:shadow-lg transition-all ${isPinned ? 'border-primary/40' : 'border-[var(--border)]'}`}
    >
      <div className="shrink-0 p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <BookOpen size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {article.title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span className="px-2.5 py-1 rounded-lg bg-[var(--muted)] font-medium text-foreground/80">
            {article.category}
          </span>
          <span className="text-muted-foreground/70">{new Date(article.created_at).toLocaleDateString('ru-RU')}</span>
          <span className="flex items-center gap-1">
            <User size={12} className="shrink-0" />
            <span className="truncate max-w-[120px]">{article.author}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Eye size={12} />
            {article.views}
          </span>
        </div>
      </div>
      <ChevronRight className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors" size={20} />
    </Link>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold font-display tracking-tight"
          >
            Найди ответы на свои <span className="text-primary">экзамены</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground"
          >
            Самая полная база решений и учебных материалов для студентов.
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            placeholder="Поиск по экзамену, предмету или теме..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </motion.div>
      </section>

      <div className="grid gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--muted)] animate-pulse" />
          ))
        ) : filteredArticles.length > 0 ? (
          <>
            {pinnedArticles.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground border-b border-[var(--border)] pb-2">Закреплённые темы</h2>
                <div className="grid gap-4">
                  {pinnedArticles.map((article, index) => (
                    <motion.div key={article.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                      {renderArticleRow(article, true)}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            {restArticles.length > 0 && (
              <h2 className="text-lg font-bold text-foreground border-b border-[var(--border)] pb-2 pt-2">Все темы</h2>
            )}
            <div className="grid gap-4">
              {visibleRest.map((article, index) => (
                <motion.div key={article.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}>
                  {renderArticleRow(article)}
                </motion.div>
              ))}
            </div>
            {hasMoreRest && (
              <button
                type="button"
                onClick={() => setVisibleCount(c => c + LOAD_MORE_STEP)}
                className="text-sm text-primary hover:underline font-medium py-1"
              >
                Показать еще
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-[var(--card)] rounded-2xl border border-dashed border-[var(--border)]">
            Ничего не найдено по вашему запросу.
          </div>
        )}
      </div>
    </div>
  );
};
