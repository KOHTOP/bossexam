import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Article, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, Edit2, Trash2, X, Save, ExternalLink, 
  Bold, Italic, List, ListOrdered, Link as LinkIcon, Quote, EyeOff, 
  Image as ImageIcon, LogOut, Lock, User, 
  BarChart3, Settings, FileText, Upload, CheckCircle2, AlertCircle,
  Users as UsersIcon, Eye, Key, MessageSquare, Check, Ban, Search as SearchIcon, ShoppingCart,
  Webhook, Copy, CheckCircle, ChevronLeft, ChevronRight, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AdminTab = 'articles' | 'settings' | 'stats' | 'users' | 'profile' | 'comments' | 'reviews' | 'products' | 'webhooks';

interface AdminProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category?: string;
  delivery_content?: string;
  tags?: string;
  created_at: string;
  is_pinned?: number | boolean;
}

interface AdminUser {
  id: number;
  username: string;
  role: string;
  display_name?: string;
  avatar?: string;
  telegram?: string;
  is_verified?: boolean;
  is_blocked?: boolean;
  block_reason?: string;
}

interface AdminComment {
  id: number;
  article_id: number;
  article_title: string;
  user_id: number;
  username: string;
  display_name: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  parent_id?: number | null;
}

interface AdminReview {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  purchase_count: number;
  last_purchase_name: string | null;
}

const WebhookUrlBlock: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/api/payment/webhook` : '';
  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL для callback</label>
      <div className="flex flex-wrap gap-2 items-center">
        <code className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-[var(--muted)] border border-[var(--border)] text-sm break-all">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Если в .env задан <code>PLATEGA_WEBHOOK_SECRET</code>, передавайте его в заголовке <code>X-Webhook-Secret</code> при вызове вебхука.
      </p>
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>(user?.role === 'user' ? 'profile' : 'articles');
  const [articles, setArticles] = useState<Article[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isEditingProduct, setIsEditingProduct] = useState<AdminProduct | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: 0, image: '', category: 'Общее', delivery_content: '', tags: '' });
  const [userSearch, setUserSearch] = useState('');
  const [articleSearch, setArticleSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState<number | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin' });
  const [changePassword, setChangePassword] = useState({ current: '', new: '', confirm: '' });
  const [profileData, setProfileData] = useState({ 
    display_name: '', 
    avatar: '', 
    telegram: '' 
  });
  
  const [currentArticle, setCurrentArticle] = useState<Partial<Article>>({
    title: '',
    slug: '',
    content: '',
    category: 'Общее',
    author: 'Администратор',
    is_pinned: false
  });
  
  // Settings state
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [userAgreement, setUserAgreement] = useState('');
  const [minTopupAmount, setMinTopupAmount] = useState('1');
  const [stats, setStats] = useState({ totalArticles: 0, totalViews: 0, lastUpdate: '', totalUsers: 0, totalProducts: 0, totalPurchases: 0, totalComments: 0, pendingComments: 0, pendingReviews: 0, totalRevenue: 0, topArticle: null as { title: string; views: number } | null });
  // PLATEGA
  const [plategaMerchantId, setPlategaMerchantId] = useState('');
  const [plategaSecret, setPlategaSecret] = useState('');
  const [plategaBaseUrl, setPlategaBaseUrl] = useState('');
  const [plategaWebhookSecret, setPlategaWebhookSecret] = useState('');
  const [paymentLog, setPaymentLog] = useState<{ items: any[]; total: number; page: number; totalPages: number }>({ items: [], total: 0, page: 1, totalPages: 0 });
  const [paymentLogPage, setPaymentLogPage] = useState(1);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const articlesTableMainRef = useRef<HTMLDivElement>(null);
  const articlesTableTopRef = useRef<HTMLDivElement>(null);
  const articlesTableBottomRef = useRef<HTMLDivElement>(null);
  const [articlesTableScrollWidth, setArticlesTableScrollWidth] = useState(0);

  useLayoutEffect(() => {
    if (activeTab !== 'articles') return;
    const el = articlesTableMainRef.current;
    if (!el) return;
    const update = () => {
      if (el) setArticlesTableScrollWidth(el.scrollWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab, articles, articleSearch]);

  const syncArticlesScrollFromMain = () => {
    const main = articlesTableMainRef.current;
    if (!main) return;
    const left = main.scrollLeft;
    if (articlesTableTopRef.current) articlesTableTopRef.current.scrollLeft = left;
    if (articlesTableBottomRef.current) articlesTableBottomRef.current.scrollLeft = left;
  };
  const syncArticlesScrollFromTop = () => {
    const top = articlesTableTopRef.current;
    if (!top) return;
    const left = top.scrollLeft;
    if (articlesTableMainRef.current) articlesTableMainRef.current.scrollLeft = left;
    if (articlesTableBottomRef.current) articlesTableBottomRef.current.scrollLeft = left;
  };
  const syncArticlesScrollFromBottom = () => {
    const bottom = articlesTableBottomRef.current;
    if (!bottom) return;
    const left = bottom.scrollLeft;
    if (articlesTableMainRef.current) articlesTableMainRef.current.scrollLeft = left;
    if (articlesTableTopRef.current) articlesTableTopRef.current.scrollLeft = left;
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else if (user.role === 'user') {
        navigate('/profile', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchArticles();
      fetchStats();
      fetchSettings();
      setProfileData({
        display_name: user.display_name || '',
        avatar: user.avatar || '',
        telegram: user.telegram || ''
      });
      if (user.role === 'superadmin' || user.role === 'admin') {
        fetchUsers();
        fetchComments();
        fetchReviews();
        fetchProducts();
      }
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'webhooks' && (user?.role === 'admin' || user?.role === 'superadmin')) {
      fetchPaymentLog(1);
    }
  }, [activeTab, user?.role]);

  const fetchArticles = () => {
    fetch('/api/articles')
      .then(res => res.ok ? res.json() : [])
      .then(data => setArticles(Array.isArray(data) ? data : []))
      .catch(() => setArticles([]));
  };

  const fetchUsers = () => {
    fetch('/api/admin/users', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => setAdminUsers(Array.isArray(data) ? data : []))
      .catch(() => setAdminUsers([]));
  };

  const fetchComments = () => {
    fetch('/api/admin/comments', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]));
  };

  const fetchReviews = () => {
    fetch('/api/admin/reviews', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]));
  };

  const fetchStats = () => {
    const defaultStats = { totalArticles: 0, totalViews: 0, lastUpdate: '', totalUsers: 0, totalProducts: 0, totalPurchases: 0, totalComments: 0, pendingComments: 0, pendingReviews: 0, totalRevenue: 0, topArticle: null as { title: string; views: number } | null };
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(res => res.ok ? res.json() : defaultStats)
      .then(data => setStats(typeof data === 'object' && data !== null ? { ...defaultStats, ...data } : defaultStats))
      .catch(() => setStats(defaultStats));
  };

  const fetchSettings = () => {
    fetch('/api/settings/privacy_policy').then(res => res.json()).then(data => setPrivacyPolicy(data.value));
    fetch('/api/settings/user_agreement').then(res => res.json()).then(data => setUserAgreement(data.value));
    fetch('/api/settings/min_topup_amount').then(res => res.json()).then(data => setMinTopupAmount((data.value && String(data.value).trim()) || '1'));
    fetch('/api/settings/platega_merchant_id').then(res => res.json()).then(data => setPlategaMerchantId(data.value || ''));
    fetch('/api/settings/platega_secret').then(res => res.json()).then(data => setPlategaSecret(data.value || ''));
    fetch('/api/settings/platega_base_url').then(res => res.json()).then(data => setPlategaBaseUrl(data.value || ''));
    fetch('/api/settings/platega_webhook_secret').then(res => res.json()).then(data => setPlategaWebhookSecret(data.value || ''));
  };

  const fetchPaymentLog = (page: number) => {
    fetch(`/api/admin/payment-log?page=${page}&limit=15`)
      .then(res => res.json())
      .then(data => {
        setPaymentLog({ items: data.items || [], total: data.total || 0, page: data.page || 1, totalPages: data.totalPages || 0 });
        setPaymentLogPage(data.page || 1);
      })
      .catch(() => {});
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products');
    }
  };

  const handleSaveArticle = async () => {
    const method = currentArticle.id ? 'PUT' : 'POST';
    const url = currentArticle.id 
      ? `/api/admin/articles/${currentArticle.id}` 
      : '/api/admin/articles';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentArticle)
      });

      if (res.ok) {
        setIsEditing(false);
        setCurrentArticle({ title: '', slug: '', content: '', category: 'Общее', author: 'Администратор', is_pinned: false });
        fetchArticles();
        fetchStats();
      } else if (res.status === 401) {
        alert('Сессия истекла. Пожалуйста, войдите снова.');
        logout();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка сохранения');
      }
    } catch (err) {
      alert('Ошибка сети или сервера');
    }
  };

  const handleCreateUser = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setIsCreatingUser(false);
        setNewUser({ username: '', password: '', role: 'admin' });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка при создании пользователя');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Удалить этого пользователя?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert('Ошибка при удалении');
    }
  };

  const handleUpdatePassword = async () => {
    if (changePassword.new !== changePassword.confirm) {
      return alert('Пароли не совпадают');
    }
    
    try {
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: changePassword.new })
      });
      if (res.ok) {
        alert('Пароль успешно изменен');
        setChangePassword({ current: '', new: '', confirm: '' });
      } else {
        alert('Ошибка при смене пароля');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        if (isEditingProduct) setIsEditingProduct({ ...isEditingProduct, image: data.url });
        else setNewProduct({ ...newProduct, image: data.url });
      } else {
        alert('Ошибка при загрузке');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const handleSaveProduct = async () => {
    const method = isEditingProduct ? 'PUT' : 'POST';
    const url = isEditingProduct ? `/api/admin/products/${isEditingProduct.id}` : '/api/admin/products';
    const body = isEditingProduct 
      ? { ...isEditingProduct, category: isEditingProduct.category || 'Общее', tags: isEditingProduct.tags || '' } 
      : { ...newProduct, category: newProduct.category || 'Общее', tags: newProduct.tags || '' };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setIsEditingProduct(null);
        setIsCreatingProduct(false);
        setNewProduct({ name: '', description: '', price: 0, image: '', category: 'Общее', delivery_content: '', tags: '' });
        fetchProducts();
      }
    } catch (err) {
      alert('Ошибка при сохранении товара');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Удалить этот товар?')) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
    } catch (err) {
      alert('Ошибка при удалении');
    }
  };

  const handleTopUp = async () => {
    const amount = prompt('Введите сумму для пополнения:');
    if (!amount) return;
    try {
      const res = await fetch('/api/balance/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(amount) })
      });
      if (res.ok) {
        alert('Баланс пополнен');
        window.location.reload();
      }
    } catch (err) {
      alert('Ошибка');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setProfileData({ ...profileData, avatar: data.url });
      } else {
        alert('Ошибка при загрузке аватарки');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const handleUserAction = async (id: number, data: any) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const errData = await res.json();
        alert(errData.error);
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const handleCommentStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchComments();
      }
    } catch (err) {
      alert('Ошибка');
    }
  };

  const handleDeleteComment = async (id: number) => {
    if (!confirm('Удалить комментарий?')) return;
    try {
      const res = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchComments();
      }
    } catch (err) {
      alert('Ошибка');
    }
  };

  const handleReviewStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchReviews();
        fetchStats();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Ошибка');
      }
    } catch (err) {
      alert('Ошибка');
    }
  };

  const handleReplySubmit = async (commentId: number) => {
    if (!replyContent.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/admin/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim() })
      });
      if (res.ok) {
        setReplyToId(null);
        setReplyContent('');
        fetchComments();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Ошибка отправки');
      }
    } catch (err) {
      alert('Ошибка сети');
    } finally {
      setReplying(false);
    }
  };

  const handleBlockUser = async () => {
    if (!isBlockingUser) return;
    try {
      const res = await fetch(`/api/admin/users/${isBlockingUser}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_blocked: 1, block_reason: blockReason })
      });
      if (res.ok) {
        setIsBlockingUser(null);
        setBlockReason('');
        fetchUsers();
      }
    } catch (err) {
      alert('Ошибка');
    }
  };

  const handleSaveSettings = async (key: string, value: string) => {
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (res.ok) {
        alert('Настройки сохранены');
      }
    } catch (err) {
      alert('Ошибка сохранения настроек');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту статью?')) return;
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        alert('Сессия истекла. Пожалуйста, войдите снова.');
        logout();
      } else {
        fetchArticles();
        fetchStats();
      }
    } catch (err) {
      alert('Ошибка при удалении');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        insertText(`![${file.name}](${data.url})`);
      } else {
        alert('Ошибка загрузки файла');
      }
    } catch (err) {
      alert('Ошибка сети при загрузке');
    }
  };

  const openEditor = (article?: Article) => {
    if (article) {
      fetch(`/api/articles/${article.slug}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then((full: Article) => setCurrentArticle(full))
        .catch(() => setCurrentArticle(article));
    } else {
      setCurrentArticle({ title: '', slug: '', content: '', category: 'Общее', author: 'Администратор' });
    }
    setIsEditing(true);
  };

  const insertText = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = currentArticle.content || '';
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    
    setCurrentArticle({ ...currentArticle, content: newText });
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + before.length, end + before.length);
      }
    }, 0);
  };

  const filteredArticles = articles.filter(a =>
    (a.title?.toLowerCase() || '').includes(articleSearch.toLowerCase()) ||
    (a.slug?.toLowerCase() || '').includes(articleSearch.toLowerCase()) ||
    (a.category?.toLowerCase() || '').includes(articleSearch.toLowerCase()) ||
    (a.author?.toLowerCase() || '').includes(articleSearch.toLowerCase())
  );

  const filteredUsers = adminUsers.filter(u => 
    u.username.toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.display_name || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  if (authLoading) return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-display tracking-tight">
            {user.role === 'user' ? 'Личный кабинет' : 'Панель управления'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Добро пожаловать, <span className="font-bold text-foreground">{user.username}</span> 
            <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] uppercase font-black">
              {user.role === 'superadmin' ? 'Главный админ' : user.role === 'admin' ? 'Модератор' : 'Пользователь'}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          {user.role !== 'user' && (
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
              Новая статья
            </button>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 bg-[var(--muted)] text-foreground px-5 py-2.5 rounded-xl font-medium hover:bg-red-500 hover:text-white transition-all border border-[var(--border)]"
          >
            <LogOut size={20} />
            Выйти
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-[var(--muted)] rounded-2xl border border-[var(--border)] w-fit">
        {user.role !== 'user' && (
          <>
            <button
              onClick={() => setActiveTab('articles')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                activeTab === 'articles' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText size={18} /> Статьи
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                activeTab === 'stats' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 size={18} /> Статистика
            </button>
          </>
        )}
        {user.role === 'superadmin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'users' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UsersIcon size={18} /> Пользователи
          </button>
        )}
        {(user.role === 'superadmin' || user.role === 'admin') && (
          <button
            onClick={() => setActiveTab('comments')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'comments' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare size={18} /> Комментарии
          </button>
        )}
        {(user.role === 'superadmin' || user.role === 'admin') && (
          <button
            onClick={() => setActiveTab('reviews')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'reviews' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star size={18} /> Отзывы
          </button>
        )}
        {user.role !== 'user' && (
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'settings' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings size={18} /> Настройки
          </button>
        )}
        {(user.role === 'superadmin' || user.role === 'admin') && (
          <button
            onClick={() => setActiveTab('products')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'products' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShoppingCart size={18} /> Товары
          </button>
        )}
        {(user.role === 'superadmin' || user.role === 'admin') && (
          <button
            onClick={() => setActiveTab('webhooks')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'webhooks' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Webhook size={18} /> PLATEGA
          </button>
        )}
        <button
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            activeTab === 'profile' ? "bg-[var(--card)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <User size={18} /> Профиль
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {activeTab === 'articles' && (
          <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 border-b border-[var(--border)]">
              <div className="relative flex-1 max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  placeholder="Поиск статей..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-primary"
                  value={articleSearch}
                  onChange={e => setArticleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col max-h-[70vh]">
              <div
                ref={articlesTableTopRef}
                className="admin-table-scroll overflow-x-auto overflow-y-hidden border-b border-[var(--border)] bg-[var(--muted)]/30 flex-shrink-0"
                style={{ height: 14 }}
                onScroll={syncArticlesScrollFromTop}
              >
                <div style={{ width: articlesTableScrollWidth || 1200, height: 1 }} />
              </div>
              <div
                ref={articlesTableMainRef}
                className="admin-table-scroll flex-1 overflow-auto min-h-0"
                onScroll={syncArticlesScrollFromMain}
              >
                <div className="min-w-max">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                        <th className="p-5 font-semibold text-sm">Заголовок</th>
                        <th className="p-5 font-semibold text-sm">Автор</th>
                        <th className="p-5 font-semibold text-sm">Категория</th>
                        <th className="p-5 font-semibold text-sm">Просмотры</th>
                        <th className="p-5 font-semibold text-sm">Дата</th>
                        <th className="p-5 font-semibold text-sm text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                  {filteredArticles.length > 0 ? filteredArticles.map(article => (
                    <tr key={article.id} className="hover:bg-[var(--muted)]/20 transition-colors group">
                      <td className="p-5">
                        <div className="font-medium max-w-[200px] truncate group-hover:text-primary transition-colors" title={article.title}>{article.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]" title={`/${article.slug}`}>/{article.slug}</div>
                      </td>
                      <td className="p-5 text-sm">{article.author}</td>
                      <td className="p-5">
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--muted)] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {article.category}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Eye size={14} />
                          {article.views}
                        </div>
                      </td>
                      <td className="p-5 text-sm text-muted-foreground">
                        {new Date(article.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-1">
                          <a 
                            href={`/article/${article.slug}`} 
                            target="_blank" 
                            className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-[var(--muted)]"
                            title="Просмотр"
                          >
                            <ExternalLink size={18} />
                          </a>
                          <button 
                            onClick={() => openEditor(article)}
                            className="p-2 text-muted-foreground hover:text-blue-500 transition-colors rounded-lg hover:bg-[var(--muted)]"
                            title="Редактировать"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(article.id)}
                            className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-[var(--muted)]"
                            title="Удалить"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                        {articles.length === 0 ? 'Статей пока нет. Создайте первую!' : 'Ничего не найдено по запросу'}
                      </td>
                    </tr>
                  )}
                </tbody>
                  </table>
                </div>
              </div>
              <div
                ref={articlesTableBottomRef}
                className="admin-table-scroll overflow-x-auto overflow-y-hidden border-t border-[var(--border)] bg-[var(--muted)]/30 flex-shrink-0"
                style={{ height: 14 }}
                onScroll={syncArticlesScrollFromBottom}
              >
                <div style={{ width: articlesTableScrollWidth || 1200, height: 1 }} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-blue-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-blue-500">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Всего статей</p>
                  <h3 className="text-3xl font-bold font-display mt-1">{stats.totalArticles}</h3>
                </div>
              </div>
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-purple-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-purple-500">
                  <Eye size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Всего просмотров</p>
                  <h3 className="text-3xl font-bold font-display mt-1">{stats.totalViews}</h3>
                </div>
              </div>
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-emerald-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-500">
                  <UsersIcon size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Пользователей</p>
                  <h3 className="text-3xl font-bold font-display mt-1">{stats.totalUsers}</h3>
                </div>
              </div>
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-amber-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-amber-500">
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Товаров</p>
                  <h3 className="text-3xl font-bold font-display mt-1">{stats.totalProducts}</h3>
                </div>
              </div>
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-cyan-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-cyan-500">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Покупок</p>
                  <h3 className="text-3xl font-bold font-display mt-1">{stats.totalPurchases}</h3>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-indigo-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-500">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Комментариев</p>
                  <h3 className="text-3xl font-bold font-display mt-1">{stats.totalComments}</h3>
                  {stats.pendingComments > 0 && (
                    <p className="text-xs text-amber-500 font-bold mt-1">Ожидают модерации: {stats.pendingComments}</p>
                  )}
                </div>
              </div>
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-green-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-green-500">
                  <Key size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Выручка (₽)</p>
                  <h3 className="text-3xl font-bold font-display mt-1">{stats.totalRevenue?.toLocaleString('ru-RU') || 0}</h3>
                </div>
              </div>
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                <div className="bg-rose-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-rose-500">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Последнее обновление</p>
                  <h3 className="text-xl font-bold font-display mt-1">
                    {stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleDateString() : 'Нет данных'}
                  </h3>
                </div>
              </div>
              {stats.topArticle && (
                <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm space-y-4">
                  <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center text-primary">
                    <FileText size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Популярная статья</p>
                    <p className="font-bold mt-1 line-clamp-2 text-sm">{stats.topArticle.title}</p>
                    <p className="text-lg font-black text-primary mt-1">{stats.topArticle.views} просмотров</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-xl font-bold font-display">Управление пользователями</h3>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input 
                    type="text" 
                    placeholder="Поиск..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm outline-none focus:border-primary"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
                {user.role === 'superadmin' && (
                  <button 
                    onClick={() => setIsCreatingUser(true)}
                    className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus size={18} /> Добавить админа
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                    <th className="p-5 font-semibold text-sm">Пользователь</th>
                    <th className="p-5 font-semibold text-sm">Роль</th>
                    <th className="p-5 font-semibold text-sm">Статус</th>
                    <th className="p-5 font-semibold text-sm text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[var(--muted)] overflow-hidden border border-[var(--border)]">
                            {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User size={20} className="m-auto mt-2 text-muted-foreground" />}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {u.display_name || u.username}
                              {!!u.is_verified && <CheckCircle2 size={14} className="text-blue-500" />}
                            </div>
                            <div className="text-xs text-muted-foreground">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-black uppercase",
                            u.role === 'superadmin' ? "bg-primary/10 text-primary" : 
                            u.role === 'admin' ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
                          )}>
                            {u.role}
                          </span>
                          {user.role === 'superadmin' && u.role !== 'superadmin' && (
                            <button 
                              onClick={() => handleUserAction(u.id, { role: 'superadmin' })}
                              className="text-[10px] font-bold text-primary hover:underline"
                            >
                              Повысить
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => user.role === 'superadmin' && handleUserAction(u.id, { is_verified: u.is_verified ? 0 : 1 })}
                            disabled={user.role !== 'superadmin'}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black uppercase transition-all w-fit",
                              u.is_verified ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground opacity-50"
                            )}
                          >
                            <CheckCircle2 size={12} />
                            {u.is_verified ? 'Подтвержден' : 'Обычный'}
                          </button>
                          {u.is_blocked ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black uppercase bg-red-500/10 text-red-500 w-fit">
                              <Ban size={12} /> Заблокирован
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2">
                          {user.role === 'superadmin' && u.username.toLowerCase() !== 'examsflow' && (
                            <>
                              {u.is_blocked ? (
                                <button 
                                  onClick={() => handleUserAction(u.id, { is_blocked: 0 })}
                                  className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                                  title="Разблокировать"
                                >
                                  <Check size={18} />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setIsBlockingUser(u.id)}
                                  className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                                  title="Заблокировать"
                                >
                                  <Ban size={18} />
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                title="Удалить"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold font-display">Модерация комментариев</h3>
            <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                    <th className="p-5 font-semibold text-sm">Автор</th>
                    <th className="p-5 font-semibold text-sm">Статья</th>
                    <th className="p-5 font-semibold text-sm">Комментарий</th>
                    <th className="p-5 font-semibold text-sm">Статус</th>
                    <th className="p-5 font-semibold text-sm text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {comments.filter(c => !c.parent_id).map(c => (
                    <React.Fragment key={c.id}>
                    <tr className={c.parent_id ? 'bg-[var(--muted)]/20' : ''}>
                      <td className="p-5">
                        <Link to={`/author/${c.username}`} className="hover:text-primary hover:underline font-medium block">{c.display_name || c.username}</Link>
                        <div className="text-xs text-muted-foreground">@{c.username}</div>
                      </td>
                      <td className="p-5">
                        <div className="text-xs font-medium line-clamp-1">{c.article_title}</div>
                      </td>
                      <td className="p-5">
                        <div className="text-sm line-clamp-2 italic">"{c.content}"</div>
                      </td>
                      <td className="p-5">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-black uppercase",
                          c.status === 'approved' ? "bg-green-500/10 text-green-500" : 
                          c.status === 'rejected' ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                        )}>
                          {c.status === 'approved' ? 'Одобрен' : c.status === 'rejected' ? 'Отклонен' : 'Ожидает'}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => setReplyToId(replyToId === c.id ? null : c.id)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Ответить"
                          >
                            <MessageSquare size={18} />
                          </button>
                          {c.status !== 'approved' && (
                            <button 
                              onClick={() => handleCommentStatus(c.id, 'approved')}
                              className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                            >
                              <Check size={18} />
                            </button>
                          )}
                          {c.status !== 'rejected' && (
                            <button 
                              onClick={() => handleCommentStatus(c.id, 'rejected')}
                              className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                            >
                              <Ban size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteComment(c.id)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {replyToId === c.id && (
                      <tr>
                        <td colSpan={5} className="p-5 bg-[var(--muted)]/30 border-l-4 border-primary">
                          <div className="flex gap-2">
                            <textarea
                              className="flex-1 min-h-[80px] p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Текст ответа..."
                              value={replyContent}
                              onChange={e => setReplyContent(e.target.value)}
                            />
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleReplySubmit(c.id)}
                                disabled={replying || !replyContent.trim()}
                                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                              >
                                {replying ? '...' : 'Отправить'}
                              </button>
                              <button
                                onClick={() => { setReplyToId(null); setReplyContent(''); }}
                                className="text-muted-foreground hover:text-foreground text-sm"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {comments.filter(r => r.parent_id === c.id).map(reply => (
                      <tr key={reply.id} className="bg-[var(--muted)]/20">
                        <td className="p-5 pl-10">
                          <Link to={`/author/${reply.username}`} className="hover:text-primary hover:underline font-medium block text-sm">{reply.display_name || reply.username}</Link>
                          <div className="text-xs text-muted-foreground">@{reply.username} · ответ</div>
                        </td>
                        <td className="p-5 text-sm text-muted-foreground">—</td>
                        <td className="p-5 text-sm italic">"{reply.content}"</td>
                        <td className="p-5">
                          <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">Ответ</span>
                        </td>
                        <td className="p-5 text-right">
                          <button onClick={() => handleDeleteComment(reply.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"> <Trash2 size={16} /> </button>
                        </td>
                      </tr>
                    ))}
                    </React.Fragment>
                  ))}
                  {comments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-muted-foreground italic">Нет комментариев для модерации</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold font-display">Модерация отзывов</h3>
            {stats.pendingReviews > 0 && (
              <p className="text-sm text-amber-500 font-bold">Ожидают модерации: {stats.pendingReviews}</p>
            )}
            <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                      <th className="p-5 font-semibold text-sm">Автор</th>
                      <th className="p-5 font-semibold text-sm">Отзыв</th>
                      <th className="p-5 font-semibold text-sm">Покупки</th>
                      <th className="p-5 font-semibold text-sm">Статус</th>
                      <th className="p-5 font-semibold text-sm text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {reviews.map((r) => (
                      <tr key={r.id}>
                        <td className="p-5">
                          <Link to={`/author/${r.username}`} className="hover:text-primary hover:underline font-medium block">{r.display_name || r.username}</Link>
                          <div className="text-xs text-muted-foreground">@{r.username}</div>
                        </td>
                        <td className="p-5">
                          <div className="text-sm line-clamp-3 max-w-md">"{r.content}"</div>
                          <div className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString('ru-RU')}</div>
                        </td>
                        <td className="p-5 text-sm">
                          Всего: {r.purchase_count}
                          {r.last_purchase_name && <div className="text-muted-foreground text-xs">Последняя: {r.last_purchase_name}</div>}
                        </td>
                        <td className="p-5">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-black uppercase",
                            r.status === 'approved' ? "bg-green-500/10 text-green-500" :
                            r.status === 'rejected' ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                          )}>
                            {r.status === 'approved' ? 'Одобрен' : r.status === 'rejected' ? 'Отклонён' : 'Ожидает'}
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {r.status !== 'approved' && (
                              <button
                                onClick={() => handleReviewStatus(r.id, 'approved')}
                                className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                                title="Одобрить"
                              >
                                <Check size={18} />
                              </button>
                            )}
                            {r.status !== 'rejected' && (
                              <button
                                onClick={() => handleReviewStatus(r.id, 'rejected')}
                                className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                                title="Отклонить"
                              >
                                <Ban size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reviews.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-muted-foreground italic">Нет отзывов</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold font-display">Управление товарами</h2>
              <button 
                onClick={() => setIsCreatingProduct(true)}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <Plus size={20} /> Добавить товар
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => (
                <div key={p.id} className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm flex flex-col">
                  <div className="aspect-video bg-white flex items-center justify-center p-4">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-black font-black text-center text-xl uppercase tracking-tighter">КАРТИНКА</div>
                    )}
                  </div>
                  <div className="p-6 space-y-4 flex-1 flex flex-col">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg uppercase tracking-tight">{p.name}</h3>
                      {(p as any).category && (
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-lg bg-[var(--muted)] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {(p as any).category}
                        </span>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{p.description}</p>
                      <p className="text-xl font-black text-primary mt-2">{p.price} ₽</p>
                    </div>
                    <div className="flex gap-2 pt-4 border-t border-[var(--border)]">
                      <button 
                        onClick={() => setIsEditingProduct(p)}
                        className="flex-1 py-2 rounded-xl bg-[var(--muted)] text-foreground font-bold text-xs uppercase hover:bg-[var(--border)] transition-all"
                      >
                        Изменить
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(p.id)}
                        className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 font-bold text-xs uppercase hover:bg-red-500 hover:text-white transition-all"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-4xl space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Profile Card */}
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
                              Администратор сайта
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 w-full border-t border-[var(--border)]">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        <span>Баланс</span>
                        <button onClick={handleTopUp} className="text-primary hover:underline">Пополнить</button>
                      </div>
                      <div className="text-3xl font-black text-foreground">{user.balance || 0} ₽</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-3 bg-[var(--muted)] text-foreground py-4 rounded-2xl font-bold hover:bg-red-500 hover:text-white transition-all border border-[var(--border)] shadow-sm"
                >
                  <LogOut size={20} />
                  Выйти из аккаунта
                </button>
              </div>

              {/* Settings Form */}
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
                        onChange={e => setProfileData({...profileData, display_name: e.target.value})}
                        placeholder="Ваш никнейм"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Telegram</label>
                      <input 
                        type="text" 
                        className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold"
                        value={profileData.telegram}
                        onChange={e => setProfileData({...profileData, telegram: e.target.value})}
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
                        onChange={e => setChangePassword({...changePassword, new: e.target.value})}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Подтверждение</label>
                      <input 
                        type="password" 
                        className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold"
                        value={changePassword.confirm}
                        onChange={e => setChangePassword({...changePassword, confirm: e.target.value})}
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
        )}

        {activeTab === 'webhooks' && (
          <div className="space-y-8">
            <div className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-xl text-primary">
                  <Webhook size={24} />
                </div>
                <h3 className="text-xl font-bold font-display">API и токен</h3>
              </div>
              <p className="text-sm text-muted-foreground">Настройки из раздела PLATEGA переопределяют переменные окружения (.env).</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Merchant ID</label>
                  <input
                    type="text"
                    placeholder="Из .env: PLATEGA_MERCHANT_ID"
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={plategaMerchantId}
                    onChange={e => setPlategaMerchantId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secret</label>
                  <input
                    type="password"
                    placeholder="Секрет API"
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={plategaSecret}
                    onChange={e => setPlategaSecret(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Base URL (необязательно)</label>
                  <input
                    type="text"
                    placeholder="https://app.platega.io"
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={plategaBaseUrl}
                    onChange={e => setPlategaBaseUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Webhook Secret (заголовок X-Webhook-Secret)</label>
                  <input
                    type="password"
                    placeholder="Опционально"
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={plategaWebhookSecret}
                    onChange={e => setPlategaWebhookSecret(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  Promise.all([
                    fetch('/api/admin/settings/platega_merchant_id', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: plategaMerchantId }) }),
                    fetch('/api/admin/settings/platega_secret', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: plategaSecret }) }),
                    fetch('/api/admin/settings/platega_base_url', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: plategaBaseUrl }) }),
                    fetch('/api/admin/settings/platega_webhook_secret', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: plategaWebhookSecret }) }),
                  ]).then(() => alert('Сохранено'));
                }}
                className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
              >
                Сохранить настройки Platega
              </button>
            </div>

            <div className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <h3 className="text-xl font-bold font-display">Callback URL (вебхук)</h3>
              <p className="text-muted-foreground text-sm">
                Укажите этот URL в личном кабинете Platega как <strong>Callback URL</strong>. При статусе CONFIRMED баланс пополнится автоматически.
              </p>
              <WebhookUrlBlock />
            </div>

            <div className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <h3 className="text-xl font-bold font-display">Лог создания платежей</h3>
              <div className="overflow-x-auto scrollbar-hide -mx-2">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                      <th className="p-3 font-semibold text-sm">Пользователь</th>
                      <th className="p-3 font-semibold text-sm">Сумма</th>
                      <th className="p-3 font-semibold text-sm">Транзакция</th>
                      <th className="p-3 font-semibold text-sm">Статус</th>
                      <th className="p-3 font-semibold text-sm">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {paymentLog.items.map((row: any) => (
                      <tr key={row.id}>
                        <td className="p-3 text-sm">{row.display_name || row.username || '—'}</td>
                        <td className="p-3 text-sm font-medium">{row.amount_rub} ₽</td>
                        <td className="p-3 text-sm font-mono text-xs truncate max-w-[140px]" title={row.platega_transaction_id}>{row.platega_transaction_id}</td>
                        <td className="p-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold uppercase",
                            row.status === 'CONFIRMED' ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
                          )}>{row.status}</span>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{row.created_at ? new Date(row.created_at).toLocaleString('ru') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paymentLog.totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    Страница {paymentLogPage} из {paymentLog.totalPages} (всего {paymentLog.total})
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={paymentLogPage <= 1}
                      onClick={() => { setPaymentLogPage(p => Math.max(1, p - 1)); fetchPaymentLog(paymentLogPage - 1); }}
                      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] disabled:opacity-50 hover:bg-[var(--muted)] transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      disabled={paymentLogPage >= paymentLog.totalPages}
                      onClick={() => { setPaymentLogPage(p => p + 1); fetchPaymentLog(paymentLogPage + 1); }}
                      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] disabled:opacity-50 hover:bg-[var(--muted)] transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="text-xl font-bold font-display">Минимальная сумма пополнения (₽)</h3>
                <button 
                  onClick={() => handleSaveSettings('min_topup_amount', minTopupAmount)}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
                >
                  Сохранить
                </button>
              </div>
              <p className="text-sm text-muted-foreground">От 1 ₽. Используется на странице пополнения и в Platega.</p>
              <input
                type="number"
                min={1}
                className="w-full max-w-xs p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] text-lg font-bold outline-none focus:ring-2 focus:ring-primary/20"
                value={minTopupAmount}
                onChange={e => setMinTopupAmount(e.target.value)}
              />
            </div>

            <div className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold font-display">Политика конфиденциальности</h3>
                <button 
                  onClick={() => handleSaveSettings('privacy_policy', privacyPolicy)}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
                >
                  Сохранить
                </button>
              </div>
              <textarea
                className="w-full h-64 p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={privacyPolicy}
                onChange={e => setPrivacyPolicy(e.target.value)}
              />
            </div>

            <div className="bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold font-display">Пользовательское соглашение</h3>
                <button 
                  onClick={() => handleSaveSettings('user_agreement', userAgreement)}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
                >
                  Сохранить
                </button>
              </div>
              <textarea
                className="w-full h-64 p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={userAgreement}
                onChange={e => setUserAgreement(e.target.value)}
              />
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {(isCreatingProduct || isEditingProduct) && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] w-full max-w-5xl max-h-[95vh] rounded-3xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/30">
                <div className="flex items-center gap-3">
                  <div className="bg-primary p-2 rounded-lg text-white">
                    <ShoppingCart size={20} />
                  </div>
                  <h2 className="text-xl font-bold font-display">
                    {isEditingProduct ? 'Редактирование товара' : 'Новый товар'}
                  </h2>
                </div>
                <button onClick={() => { setIsCreatingProduct(false); setIsEditingProduct(null); }} className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto scrollbar-hide space-y-8 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Название</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={isEditingProduct ? isEditingProduct.name : newProduct.name}
                      onChange={e => isEditingProduct ? setIsEditingProduct({...isEditingProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})}
                      placeholder="Название товара"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Цена (₽)</label>
                    <input
                      type="number"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={isEditingProduct ? isEditingProduct.price : newProduct.price}
                      onChange={e => isEditingProduct ? setIsEditingProduct({...isEditingProduct, price: parseInt(e.target.value) || 0}) : setNewProduct({...newProduct, price: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Категория</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={isEditingProduct ? (isEditingProduct.category || 'Общее') : newProduct.category}
                      onChange={e => isEditingProduct ? setIsEditingProduct({...isEditingProduct, category: e.target.value}) : setNewProduct({...newProduct, category: e.target.value})}
                      placeholder="Общее"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Теги (через запятую)</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={isEditingProduct ? (isEditingProduct.tags || '') : newProduct.tags}
                      onChange={e => isEditingProduct ? setIsEditingProduct({...isEditingProduct, tags: e.target.value}) : setNewProduct({...newProduct, tags: e.target.value})}
                      placeholder="2022-2023, 2023-2024"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Фото товара</label>
                  <div className="border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col">
                    <div className="bg-[var(--muted)]/50 p-3 border-b border-[var(--border)] flex items-center gap-4">
                      <button
                        onClick={() => document.getElementById('product-image-upload')?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
                      >
                        <Upload size={18} />
                        Загрузить файл
                      </button>
                      <input id="product-image-upload" type="file" className="hidden" accept="image/*" onChange={handleProductImageUpload} />
                      <span className="text-xs text-muted-foreground">или вставьте ссылку:</span>
                      <input
                        type="text"
                        className="flex-1 p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        value={isEditingProduct ? (isEditingProduct.image || '') : newProduct.image}
                        onChange={e => isEditingProduct ? setIsEditingProduct({...isEditingProduct, image: e.target.value}) : setNewProduct({...newProduct, image: e.target.value})}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="aspect-video bg-[var(--muted)] flex items-center justify-center overflow-hidden min-h-[200px]">
                      {(isEditingProduct ? isEditingProduct.image : newProduct.image) ? (
                        <img src={isEditingProduct ? isEditingProduct.image : newProduct.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground font-bold uppercase text-sm">Картинка появится после загрузки</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Описание</label>
                  <textarea
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium min-h-[120px] resize-none"
                    value={isEditingProduct ? (isEditingProduct.description || '') : newProduct.description}
                    onChange={e => isEditingProduct ? setIsEditingProduct({...isEditingProduct, description: e.target.value}) : setNewProduct({...newProduct, description: e.target.value})}
                    placeholder="Описание товара..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Ссылка/текст для выдачи после покупки</label>
                  <textarea
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium min-h-[80px] resize-none"
                    value={isEditingProduct ? (isEditingProduct.delivery_content || '') : newProduct.delivery_content}
                    onChange={e => isEditingProduct ? setIsEditingProduct({...isEditingProduct, delivery_content: e.target.value}) : setNewProduct({...newProduct, delivery_content: e.target.value})}
                    placeholder="Ссылка на скачивание или текст..."
                  />
                </div>
                {isEditingProduct && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!isEditingProduct.is_pinned}
                      onChange={e => setIsEditingProduct({...isEditingProduct, is_pinned: e.target.checked})}
                      className="rounded border-[var(--border)]"
                    />
                    <span className="text-sm font-medium">Закрепить товар (показывать вверху)</span>
                  </label>
                )}
              </div>

              <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--muted)]/30">
                <button onClick={() => { setIsCreatingProduct(false); setIsEditingProduct(null); }} className="px-6 py-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--muted)] transition-all font-medium">
                  Отмена
                </button>
                <button onClick={handleSaveProduct} className="flex items-center gap-2 bg-primary text-white px-10 py-3 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20">
                  <Save size={20} />
                  Сохранить товар
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {isCreatingUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--card)] w-full max-w-md p-8 rounded-3xl shadow-2xl border border-[var(--border)] space-y-6"
            >
              <h2 className="text-2xl font-bold font-display">Новый администратор</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Логин</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-primary/20"
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Пароль</label>
                  <input 
                    type="password" 
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-primary/20"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Роль</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-primary/20"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                  >
                    <option value="admin">Модератор</option>
                    <option value="superadmin">Главный админ</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsCreatingUser(false)} className="flex-1 py-3 rounded-xl border border-[var(--border)] font-medium">Отмена</button>
                <button onClick={handleCreateUser} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold">Создать</button>
              </div>
            </motion.div>
          </div>
        )}

        {isBlockingUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--card)] w-full max-w-md p-8 rounded-3xl shadow-2xl border border-[var(--border)] space-y-6"
            >
              <h2 className="text-2xl font-bold font-display">Блокировка пользователя</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Причина блокировки</label>
                  <textarea 
                    className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] min-h-[120px] outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    placeholder="Укажите причину..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsBlockingUser(null)} className="flex-1 py-3 rounded-xl border border-[var(--border)] font-medium">Отмена</button>
                <button onClick={handleBlockUser} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Заблокировать</button>
              </div>
            </motion.div>
          </div>
        )}

        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] w-full max-w-6xl max-h-[95vh] rounded-3xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/30">
                <div className="flex items-center gap-3">
                  <div className="bg-primary p-2 rounded-lg text-white">
                    <FileText size={20} />
                  </div>
                  <h2 className="text-xl font-bold font-display">
                    {currentArticle.id ? 'Редактирование' : 'Новая публикация'}
                  </h2>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-2 rounded-full hover:bg-[var(--muted)] transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Заголовок</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={currentArticle.title}
                      onChange={e => setCurrentArticle({ ...currentArticle, title: e.target.value })}
                      placeholder="Введите название статьи"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Slug (URL)</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={currentArticle.slug}
                      onChange={e => setCurrentArticle({ ...currentArticle, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      placeholder="url-stati"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Категория</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={currentArticle.category}
                      onChange={e => setCurrentArticle({ ...currentArticle, category: e.target.value })}
                      placeholder="Напр. Математика"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Автор</label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                      value={currentArticle.author}
                      onChange={e => setCurrentArticle({ ...currentArticle, author: e.target.value })}
                      placeholder="Имя автора"
                    />
                  </div>
                  {currentArticle.id && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!currentArticle.is_pinned}
                        onChange={e => setCurrentArticle({ ...currentArticle, is_pinned: e.target.checked })}
                        className="rounded border-[var(--border)]"
                      />
                      <span className="text-sm font-medium">Закрепить тему (показывать вверху списка)</span>
                    </label>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Контент (Markdown)</label>
                  <div className="border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-[var(--muted)]/50 p-3 border-b border-[var(--border)] flex flex-wrap gap-2">
                      <button onClick={() => insertText('**', '**')} className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all" title="Жирный"><Bold size={18} /></button>
                      <button onClick={() => insertText('*', '*')} className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all" title="Курсив"><Italic size={18} /></button>
                      <div className="w-px h-6 bg-[var(--border)] mx-1" />
                      <button onClick={() => insertText('\n- ')} className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all" title="Список"><List size={18} /></button>
                      <button onClick={() => insertText('\n1. ')} className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all" title="Нумерованный список"><ListOrdered size={18} /></button>
                      <button onClick={() => insertText('\n> ', '')} className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all" title="Цитата"><Quote size={18} /></button>
                      <button onClick={() => insertText('\n<details><summary>Спойлер</summary>\n\n', '\n\n</details>\n')} className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all" title="Спойлер"><EyeOff size={18} /></button>
                      <div className="w-px h-6 bg-[var(--border)] mx-1" />
                      <button onClick={() => insertText('[', '](url)')} className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all" title="Ссылка"><LinkIcon size={18} /></button>
                      <button
                        onClick={() => { const id = prompt('ID товара:'); if (id && /^\d+$/.test(id)) insertText(`\n[product:${id}]\n`, ''); }}
                        className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all flex items-center gap-1"
                        title="Вставить блок товара"
                      >
                        <ShoppingCart size={16} />
                        <span className="text-[10px] font-bold">Товар</span>
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all flex items-center gap-2" 
                        title="Загрузить фото"
                      >
                        <Upload size={18} />
                        <span className="text-xs font-bold uppercase">Загрузить</span>
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileUpload}
                      />
                    </div>
                    <textarea
                      ref={textareaRef}
                      className="w-full h-[400px] p-6 bg-[var(--background)] font-mono text-sm outline-none resize-none leading-relaxed"
                      value={currentArticle.content}
                      onChange={e => setCurrentArticle({ ...currentArticle, content: e.target.value })}
                      placeholder="# Заголовок\n\nТекст статьи..."
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--muted)]/30">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--muted)] transition-all font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveArticle}
                  className="flex items-center gap-2 bg-primary text-white px-10 py-3 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95"
                >
                  <Save size={20} />
                  Сохранить публикацию
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
