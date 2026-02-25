import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Article } from '../lib/utils';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ChevronLeft, Calendar, Tag, Share2, User, Eye, MessageSquare, Send, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ProductEmbed } from '../components/ProductEmbed';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { mathInlineToHtml } from '../lib/mathInline';

interface Comment {
  id: number;
  content: string;
  username: string;
  display_name: string;
  avatar: string;
  is_verified: boolean;
  created_at: string;
  parent_id?: number | null;
}

export const ArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  
  // Comment form state
  const [commentContent, setCommentContent] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaText, setCaptchaText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/articles/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setArticle(data);
          
          // Track view
          fetch(`/api/articles/${slug}/view`, { method: 'POST', credentials: 'include' });
          
          // Fetch comments
          const commentsRes = await fetch(`/api/articles/${slug}/comments`);
          if (commentsRes.ok) {
            setComments(await commentsRes.json());
          }
        }
      } catch (err) {
        console.error('Failed to fetch article:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    refreshCaptcha();
  }, [slug]);

  const descFromContent = article?.content
    ? article.content.replace(/#{1,6}\s/g, '').replace(/\*\*?|__?/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' ').trim().slice(0, 160)
    : undefined;
  useDocumentHead(article?.title ?? 'Статья', descFromContent);

  const refreshCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha');
      const data = await res.json();
      setCaptchaId(data.captchaId ?? null);
      setCaptchaText(data.captcha ?? '');
    } catch (err) {
      console.error('Failed to fetch captcha');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setToastMsg('Ссылка скопирована в буфер');
      setShowToast(true);
      // Play sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Ignore if blocked by browser
      
      setTimeout(() => setShowToast(false), 3000);
    });
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (user.is_blocked) return;
    if (!commentContent.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await authFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          article_id: article?.id,
          content: commentContent,
          captcha,
          captchaId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCommentContent('');
        setCaptcha('');
        refreshCaptcha();
        setToastMsg('Комментарий отправлен на модерацию');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Ошибка при отправке комментария');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="animate-pulse space-y-4">
    <div className="h-8 w-2/3 bg-[var(--muted)] rounded" />
    <div className="h-4 w-1/4 bg-[var(--muted)] rounded" />
    <div className="h-64 w-full bg-[var(--muted)] rounded" />
  </div>;

  if (!article) return <div className="text-center py-24">Статья не найдена</div>;

  return (
    <motion.article 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronLeft size={16} />
        Назад к списку
      </Link>

      <header className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold font-display leading-tight">
          {article.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar size={16} />
            {new Date(article.created_at).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1.5">
            <Tag size={16} />
            {article.category}
          </div>
          <div className="flex items-center gap-1.5">
            <User size={16} />
            <Link to={`/author/${article.author}`} className="hover:text-primary transition-colors font-medium">
              {article.author}
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye size={16} />
            {article.views}
          </div>
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 hover:text-primary transition-all ml-auto bg-[var(--muted)] px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95"
          >
            <Share2 size={16} />
            Поделиться
          </button>
        </div>
      </header>

      <div className="markdown-body markdown-content bg-[var(--card)] p-6 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm">
        {(() => {
          const parts = article.content.split(/(\[product:\d+\])/g);
          return parts.map((part, i) => {
            const m = part.match(/^\[product:(\d+)\]$/);
            if (m) return <ProductEmbed key={i} id={parseInt(m[1], 10)} />;
            return (
              <Markdown
                key={i}
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
                      {children}
                    </a>
                  ),
                  table: ({ children, ...props }) => (
                    <div className="table-scroll-wrap">
                      <table {...props}>{children}</table>
                    </div>
                  ),
                  thead: ({ children, ...props }) => <thead {...props}>{children}</thead>,
                  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
                  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
                  th: ({ children, ...props }) => <th {...props}>{children}</th>,
                  td: ({ children, ...props }) => <td {...props}>{children}</td>,
                }}
              >
                {mathInlineToHtml(part)}
              </Markdown>
            );
          });
        })()}
      </div>

      {/* Comments Section */}
      <div className="space-y-8 pt-8 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold font-display flex items-center gap-3">
            <MessageSquare className="text-primary" /> Комментарии ({comments.length})
          </h2>
        </div>

        {user ? (
          user.is_blocked ? (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-red-500 font-medium">
              Вы были заблокированы администратором сайта. Причина: {user.block_reason || 'Не указана'}
            </div>
          ) : (
            <form onSubmit={handleCommentSubmit} className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] space-y-4 shadow-sm">
              <textarea
                className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] min-h-[120px] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                placeholder="Напишите ваш комментарий..."
                value={commentContent}
                onChange={e => setCommentContent(e.target.value)}
                required
              />
              
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3 bg-[var(--muted)] p-2 rounded-xl border border-[var(--border)]">
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
                  className="w-full md:w-32 p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-center font-bold uppercase"
                  placeholder="Код"
                  value={captcha}
                  onChange={e => setCaptcha(e.target.value.toUpperCase())}
                  required
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full md:w-auto md:ml-auto bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={18} />
                  {submitting ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </form>
          )
        ) : (
          <div className="bg-[var(--muted)]/50 p-8 rounded-2xl border border-dashed border-[var(--border)] text-center space-y-4">
            <p className="text-muted-foreground font-medium">Войдите, чтобы оставить комментарий</p>
            <Link 
              to="/auth" 
              className="inline-block bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all"
            >
              Войти
            </Link>
          </div>
        )}

        <div className="space-y-6">
          {(() => {
            const topLevel = comments.filter(c => !c.parent_id);
            const getReplies = (id: number) => comments.filter(c => c.parent_id === id);
            return topLevel.map((comment, index) => (
              <motion.div key={comment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="space-y-4">
                <div className="flex gap-4">
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-[var(--muted)] overflow-hidden border border-[var(--border)]">
                      {comment.avatar ? (
                        <img src={comment.avatar} alt={comment.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <User size={24} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Link to={`/author/${comment.username}`} className="font-bold text-sm hover:text-primary hover:underline">
                        {comment.display_name || comment.username}
                      </Link>
                      {!!comment.is_verified && (
                        <div className="group relative">
                          <CheckCircle2 size={14} className="text-blue-500" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-black text-white text-[10px] rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            Этот пользователь является администратором сайта
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
                          </div>
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground uppercase font-black opacity-40">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] text-sm leading-relaxed shadow-sm">
                      {comment.content}
                    </div>
                  </div>
                </div>
                {getReplies(comment.id).map(reply => (
                  <div key={reply.id} className="flex gap-4 pl-6 ml-4 border-l-2 border-primary/30">
                    <div className="shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-[var(--muted)] overflow-hidden border border-[var(--border)]">
                        {reply.avatar ? (
                          <img src={reply.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><User size={20} /></div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Link to={`/author/${reply.username}`} className="font-medium text-sm hover:text-primary hover:underline">
                          {reply.display_name || reply.username}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">ответ · {new Date(reply.created_at).toLocaleString()}</span>
                      </div>
                      <div className="bg-[var(--muted)]/50 p-3 rounded-xl text-sm">{reply.content}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ));
          })()}
          {comments.length === 0 && (
            <p className="text-center py-8 text-muted-foreground italic">Пока нет комментариев. Будьте первым!</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-[200] bg-primary text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-lg"
          >
            <div className="bg-white/20 p-2 rounded-lg">
              <Share2 size={20} />
            </div>
            <div>
              <p className="font-black uppercase text-xs tracking-widest">Успешно</p>
              <p className="text-sm font-medium opacity-90">{toastMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};
