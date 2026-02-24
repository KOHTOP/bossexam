import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, ArrowLeft, Minus, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useDocumentHead } from '../hooks/useDocumentHead';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category?: string;
  tags?: string;
}

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [cart, setCart] = useState<{ id: number; name: string; price: number; image: string; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetch(`/api/products/${id}`)
        .then(res => res.json())
        .then((data) => {
          setProduct(data);
          return fetch('/api/products');
        })
        .then(res => res.json())
        .then((all: Product[]) => {
          const related = all.filter(p => p.id !== Number(id)).slice(0, 4);
          setRelatedProducts(related);
        })
        .catch(() => setProduct(null))
        .finally(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    if (user) {
      fetch('/api/cart')
        .then(res => res.ok ? res.json() : [])
        .then((data: any[]) => setCart(data.map((item: any) => ({ id: item.id, name: item.name, price: item.price, image: item.image, quantity: item.quantity }))))
        .catch(() => setCart([]));
    } else {
      setCart([]);
    }
  }, [user]);

  const addToCart = async () => {
    if (!user) {
      setMessage({ text: 'Войдите, чтобы добавить в корзину', type: 'error' });
      return;
    }
    if (!product) return;
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, quantity })
      });
      if (res.ok) {
        setMessage({ text: 'Товар добавлен в корзину', type: 'success' });
        fetch('/api/cart')
          .then(r => r.ok ? r.json() : [])
          .then((data: any[]) => setCart(data.map((item: any) => ({ id: item.id, name: item.name, price: item.price, image: item.image, quantity: item.quantity }))));
      } else {
        setMessage({ text: 'Ошибка при добавлении', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Ошибка сети', type: 'error' });
    }
  };

  const tags = product?.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  useDocumentHead(product?.name ?? 'Товар', product?.description?.slice(0, 160));

  if (loading) return <div className="flex justify-center h-64">Загрузка...</div>;
  if (!product) return <div className="text-center py-16">Товар не найден</div>;

  return (
    <div className="space-y-10">
      <Link to="/products" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-medium">
        <ArrowLeft size={20} />
        Назад к товарам
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-xl flex flex-col lg:flex-row"
      >
        <div className="lg:w-1/2 aspect-square w-full overflow-hidden bg-[var(--muted)]">
          {(() => {
            const imgSrc = product.image && (product.image.startsWith('http') || product.image.startsWith('/') ? product.image : `/uploads/${product.image}`);
            return imgSrc ? (
              <img src={imgSrc} alt={product.name} className="w-full h-full object-cover object-center" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--muted)] text-muted-foreground font-black text-2xl uppercase tracking-tighter text-center">
                Картинка товара
              </div>
            );
          })()}
        </div>
        <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col">
          <h1 className="text-xl lg:text-2xl font-black uppercase tracking-tight text-foreground">{product.name}</h1>
          
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Краткое описание</p>
              <p className="text-foreground leading-relaxed">
                {product.description || 'Описание товара отсутствует.'}
              </p>
            </div>
            {product.category && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Категории</p>
                <span className="inline-block px-3 py-1.5 rounded-xl bg-[var(--muted)] text-sm font-bold text-foreground">
                  {product.category}
                </span>
              </div>
            )}
            {tags.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Теги</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-xl bg-[var(--muted)] text-sm font-bold text-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-[var(--border)] space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-bold text-green-600 dark:text-green-400">В наличии</span>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-2xl font-black text-foreground">{product.price.toLocaleString('ru-RU')} ₽</span>
              <div className="flex items-center border border-[var(--border)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="p-3 hover:bg-[var(--muted)] transition-colors"
                >
                  <Minus size={18} />
                </button>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center font-bold bg-transparent outline-none border-x border-[var(--border)] py-2"
                />
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="p-3 hover:bg-[var(--muted)] transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            {message && (
              <div className={cn(
                "p-4 rounded-2xl font-bold text-center text-sm",
                message.type === 'success' ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
              )}>
                {message.text}
              </div>
            )}
            <button
              onClick={addToCart}
              className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold text-base uppercase tracking-wide hover:bg-primary/90 transition-all shadow-lg shadow-primary/30"
            >
              <ShoppingCart size={20} />
              В корзину
            </button>
          </div>
        </div>
      </motion.div>

      <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-xl">
        <div className="p-6 border-b border-[var(--border)] bg-[var(--muted)]/30">
          <span className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold">Описание</span>
        </div>
        <div className="p-8 prose prose-invert max-w-none">
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Полный доступ к материалам после оплаты</li>
            <li>Официальные ответы и критерии оценивания</li>
            <li>Удобная сортировка по предметам и датам</li>
            <li>Ссылка на скачивание высылается на email после оплаты</li>
            <li>Материалы полезны преподавателям, родителям и ученикам</li>
          </ul>
          {product.description && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <p className="whitespace-pre-wrap text-muted-foreground">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Корзина справа снизу */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative bg-primary text-white p-4 rounded-2xl shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          title="Корзина"
        >
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center border-2 border-[var(--card)]">
              {cart.reduce((acc, i) => acc + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[110] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="relative w-full max-w-md bg-[var(--card)] h-full shadow-2xl border-l border-[var(--border)] flex flex-col">
              <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-xl font-black uppercase flex items-center gap-2"><ShoppingCart className="text-primary" /> Корзина</h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-[var(--muted)] rounded-full"><X size={22} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Корзина пуста</p>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-[var(--muted)]/30 rounded-xl text-sm">
                      <div className="w-14 h-14 rounded-lg bg-white shrink-0 overflow-hidden">
                        {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">—</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold line-clamp-1">{item.name}</p>
                        <p className="text-primary font-bold">{item.price} ₽ × {item.quantity}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {cart.length > 0 && (
                <div className="p-6 border-t border-[var(--border)]">
                  <p className="text-sm text-muted-foreground mb-2">Итого: <span className="font-black text-primary">{cart.reduce((a, i) => a + i.price * i.quantity, 0)} ₽</span></p>
                  <Link to="/products" onClick={() => setIsCartOpen(false)} className="block w-full bg-primary text-white py-3 rounded-xl font-bold text-center hover:bg-primary/90">В магазин / Оплатить</Link>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {relatedProducts.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-black uppercase tracking-tight">Сопутствующие товары</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-lg hover:border-primary/30 transition-all group h-full flex flex-col"
                >
                  <div className="aspect-square w-full overflow-hidden bg-[var(--muted)]">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-black text-sm uppercase">Картинка</div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold uppercase tracking-tight line-clamp-2 text-sm">{p.name}</h3>
                    <div className="mt-auto pt-4">
                      <span className="text-xs text-green-600 dark:text-green-400 font-bold">В наличии</span>
                      <p className="text-lg font-black text-primary mt-1">{p.price} ₽</p>
                      <span className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-primary">В корзину <ShoppingCart size={14} /></span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
