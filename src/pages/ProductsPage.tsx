import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, X, Search as SearchIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../lib/auth';
import { cn } from '../lib/utils';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category?: string;
  is_pinned?: number | boolean;
  carousel_order?: number | null;
  badge?: string | null;
}

interface CartItem extends Product {
  cart_id: number;
  quantity: number;
}

export const ProductsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    fetchProducts();
    if (user) fetchCart();
  }, [user]);

  const fetchProducts = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/products/categories')
      ]);
      const data = await productsRes.json();
      setProducts(Array.isArray(data) ? data : []);
      const cats = await categoriesRes.json();
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCart = async () => {
    try {
      const res = await authFetch('/api/cart');
      if (res.status === 401) {
        setCart([]);
        return;
      }
      const data = res.ok ? await res.json() : [];
      setCart(Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        cart_id: item.id
      })) : []);
    } catch {
      setCart([]);
    }
  };

  const addToCart = async (product: Product) => {
    if (!user) {
      setMessage({ text: 'Войдите, чтобы добавить в корзину', type: 'error' });
      return;
    }
    try {
      const res = await authFetch('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.id })
      });
      if (res.ok) {
        fetchCart();
        setMessage({ text: 'Товар добавлен в корзину', type: 'success' });
      }
    } catch (err) {
      setMessage({ text: 'Ошибка при добавлении', type: 'error' });
    }
  };

  const removeFromCart = async (cartId: number) => {
    try {
      const res = await authFetch(`/api/cart/${cartId}`, { method: 'DELETE' });
      if (res.ok) fetchCart();
    } catch (err) {
      console.error('Failed to remove from cart');
    }
  };

  const checkout = async () => {
    try {
      const res = await authFetch('/api/cart/checkout', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const names = cart.map(i => i.name).join(', ');
        setCart([]);
        setIsCartOpen(false);
        setMessage({ text: `Вы успешно приобрели ${names}. Товар появился у вас в профиле.`, type: 'success' });
        refreshUser?.();
      } else {
        setMessage({ text: data.error || 'Ошибка при оплате', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Ошибка сети', type: 'error' });
    }
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const filteredProducts = products.filter(p => {
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || (p.category || '') === categoryFilter;
    return matchSearch && matchCategory;
  });
  const carouselProducts = filteredProducts.filter((p: Product) => p.carousel_order != null).sort((a: Product, b: Product) => (a.carousel_order ?? 0) - (b.carousel_order ?? 0));
  const pinnedProducts = filteredProducts.filter(p => p.is_pinned);
  const restProducts = filteredProducts.filter(p => !p.is_pinned);

  const productImageSrc = (img: string | undefined) =>
    !img ? '' : img.startsWith('http') || img.startsWith('/') ? img : `/uploads/${img}`;

  const badgeLabel = (badge: string | null | undefined) =>
    !badge ? null : badge === 'discount' ? 'Скидка' : badge === 'new' ? 'Новинка' : badge === 'hit' ? 'Хит' : badge;
  const badgeClass = (badge: string | null | undefined) =>
    !badge ? '' : badge === 'discount' ? 'bg-red-500 text-white' : badge === 'new' ? 'bg-green-500 text-white' : badge === 'hit' ? 'bg-amber-500 text-white' : 'bg-[var(--muted)] text-foreground';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black font-display tracking-tight uppercase shrink-0">Магазин товаров</h1>
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:max-w-xl">
          <div className="relative flex-1 min-w-[180px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Поиск товаров..."
              className="w-full pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground rounded-xl border border-[var(--border)] bg-[var(--card)] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="shrink-0 py-2 pl-3 pr-8 text-sm text-foreground rounded-xl border border-[var(--border)] bg-[var(--card)] outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]"
          >
            <option value="">Все категории</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="relative flex items-center gap-2 bg-primary text-white p-4 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
        >
          <ShoppingCart size={24} className="shrink-0" />
          <span className="md:hidden font-bold">Корзина</span>
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-4 border-[var(--background)]">
              {cart.reduce((acc, i) => acc + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-5 rounded-2xl font-bold text-center shadow-lg",
              message.type === 'success' ? "bg-green-500 text-white" : "bg-red-500 text-white"
            )}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center h-64">Загрузка товаров...</div>
      ) : (
        <>
          {carouselProducts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-foreground">Рекомендуем</h2>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {carouselProducts.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const el = carouselScrollRef.current;
                          if (el) {
                            const step = 280 + 24;
                            el.scrollTo({ left: i * step, behavior: 'smooth' });
                            setCarouselIndex(i);
                          }
                        }}
                        className={cn(
                          'w-2.5 h-2.5 rounded-full transition-all',
                          i === carouselIndex ? 'bg-primary scale-110' : 'bg-[var(--border)] hover:bg-primary/50'
                        )}
                        aria-label={`Слайд ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => carouselScrollRef.current?.scrollBy({ left: -(280 + 24), behavior: 'smooth' })}
                      className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] hover:border-primary/30 transition-colors"
                      aria-label="Назад"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={() => carouselScrollRef.current?.scrollBy({ left: 280 + 24, behavior: 'smooth' })}
                      className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] hover:border-primary/30 transition-colors"
                      aria-label="Вперёд"
                    >
                      <ChevronRight size={22} />
                    </button>
                  </div>
                </div>
              </div>
              <div
                ref={carouselScrollRef}
                className="overflow-x-auto overflow-y-hidden pb-4 -mx-2 snap-x snap-mandatory scroll-smooth"
                style={{ scrollbarGutter: 'stable' }}
                onScroll={() => {
                  const el = carouselScrollRef.current;
                  if (!el || carouselProducts.length === 0) return;
                  const step = 280 + 24;
                  const idx = Math.round(el.scrollLeft / step);
                  setCarouselIndex(Math.min(idx, carouselProducts.length - 1));
                }}
                onWheel={(e) => {
                  const el = carouselScrollRef.current;
                  if (!el || e.ctrlKey || e.metaKey) return;
                  const maxScroll = el.scrollWidth - el.clientWidth;
                  if (maxScroll <= 0) return;
                  if (el.scrollLeft <= 0 && e.deltaY < 0) return;
                  if (el.scrollLeft >= maxScroll && e.deltaY > 0) return;
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                  }
                }}
              >
                <div className="flex gap-6 min-w-max px-2">
                  {carouselProducts.map((product) => (
                    <Link
                      key={product.id}
                      to={`/products/${product.id}`}
                      className="shrink-0 w-[280px] snap-center snap-always"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-[var(--card)] rounded-2xl overflow-hidden flex flex-col shadow-lg border border-[var(--border)] group h-full hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all cursor-pointer"
                      >
                        <div className="relative w-full aspect-[4/3] overflow-hidden bg-[var(--muted)] flex items-center justify-center shrink-0">
                          {productImageSrc(product.image) ? (
                            <img src={productImageSrc(product.image)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="text-muted-foreground font-black text-center text-sm uppercase tracking-tighter">Картинка товара</div>
                          )}
                          {product.badge && (
                            <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm', badgeClass(product.badge))}>
                              {badgeLabel(product.badge)}
                            </span>
                          )}
                        </div>
                        <div className="p-4 space-y-2 flex-1 flex flex-col min-w-0">
                          {product.category && (
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-[var(--muted)] text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-fit">
                              {product.category}
                            </span>
                          )}
                          <h3 className="text-foreground font-bold text-sm line-clamp-2 leading-snug">
                            {product.name}
                          </h3>
                          <div className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm text-center group-hover:bg-primary/90 transition-colors mt-auto">
                            {product.price} ₽
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
          {pinnedProducts.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground border-b border-[var(--border)] pb-2">Закреплённые товары</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pinnedProducts.map((product) => (
                  <Link key={product.id} to={`/products/${product.id}`}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-[var(--card)] rounded-2xl p-2 flex flex-col shadow-xl border border-primary/40 group h-full hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[var(--muted)] flex items-center justify-center shrink-0">
                        {productImageSrc(product.image) ? (
                          <img src={productImageSrc(product.image)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="text-muted-foreground font-black text-center text-sm uppercase tracking-tighter">
                            Картинка товара
                          </div>
                        )}
                        {product.badge && (
                          <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider', badgeClass(product.badge))}>
                            {badgeLabel(product.badge)}
                          </span>
                        )}
                      </div>
                      <div className="px-3 pb-3 pt-2 space-y-2 flex-1 flex flex-col min-w-0">
                        {product.category && (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[var(--muted)] text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-fit">
                            {product.category}
                          </span>
                        )}
                        <h3 className="text-foreground font-bold text-sm uppercase tracking-tight line-clamp-2 leading-snug">
                          {product.name}
                        </h3>
                        <div className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide text-center group-hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 mt-auto">
                          {product.price} ₽
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(pinnedProducts.length > 0 || restProducts.length > 0) && pinnedProducts.length > 0 && (
            <h2 className="text-lg font-bold text-foreground border-b border-[var(--border)] pb-2 mt-8">Все товары</h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restProducts.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[var(--card)] rounded-2xl p-2 flex flex-col shadow-xl border border-[var(--border)] group h-full hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[var(--muted)] flex items-center justify-center shrink-0">
                    {productImageSrc(product.image) ? (
                      <img src={productImageSrc(product.image)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="text-muted-foreground font-black text-center text-sm uppercase tracking-tighter">
                        Картинка товара
                      </div>
                    )}
                    {product.badge && (
                      <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider', badgeClass(product.badge))}>
                        {badgeLabel(product.badge)}
                      </span>
                    )}
                  </div>
                  <div className="px-3 pb-3 pt-2 space-y-2 flex-1 flex flex-col min-w-0">
                    {product.category && (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[var(--muted)] text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-fit">
                        {product.category}
                      </span>
                    )}
                    <h3 className="text-foreground font-bold text-sm uppercase tracking-tight line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                    <div className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide text-center group-hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 mt-auto">
                      {product.price} ₽
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </>
      )}
      {filteredProducts.length === 0 && !loading && (
        <p className="text-center text-muted-foreground py-16">Товары не найдены</p>
      )}

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[110] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="relative w-full max-w-md bg-[var(--card)] h-full shadow-2xl border-l border-[var(--border)] flex flex-col"
            >
              <div className="p-8 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                  <ShoppingCart className="text-primary" /> Корзина
                </h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-[var(--muted)] rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <ShoppingCart size={64} />
                    <p className="font-bold uppercase tracking-widest">Корзина пуста</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.cart_id} className="flex gap-4 p-4 bg-[var(--muted)]/30 rounded-2xl border border-[var(--border)]">
                      <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center p-2 shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <div className="text-black font-black text-[8px] text-center uppercase tracking-tighter">КАРТИНКА</div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-bold uppercase text-sm line-clamp-1">{item.name}</h4>
                        <p className="text-primary font-black">{item.price} ₽ x {item.quantity}</p>
                        <button 
                          onClick={() => removeFromCart(item.cart_id)}
                          className="text-[10px] font-black uppercase text-red-500 hover:underline"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-[var(--border)] bg-[var(--muted)]/30 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Итого</span>
                    <span className="text-3xl font-black text-primary">{cartTotal} ₽</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest opacity-60">
                      <span>Ваш баланс</span>
                      <span>{user?.balance || 0} ₽</span>
                    </div>
                    <button 
                      onClick={checkout}
                      className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xl uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/30"
                    >
                      Оплатить заказ
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
