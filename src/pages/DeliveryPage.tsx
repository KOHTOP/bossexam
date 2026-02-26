import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useDocumentHead } from '../hooks/useDocumentHead';

type DeliveryData = {
  product_id: number;
  product_name: string;
  delivery_content: string | null;
  product_image: string | null;
  product_price: number | null;
  product_category: string | null;
};

export const DeliveryPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DeliveryData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      return;
    }
    fetch(`/api/delivery/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(d => setData(d))
      .catch(() => setError(true));
  }, [token]);

  useDocumentHead(data ? `Выдача: ${data.product_name}` : 'Выдача товара', undefined, undefined, true);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <p className="text-muted-foreground font-medium">Ссылка не найдена или устарела.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
          <ArrowLeft size={18} /> На главную
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="inline-block w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  const isUrl = (s: string) => /^https?:\/\/\S+/i.test(s.trim());
  const renderProductContent = () => {
    const content = data.delivery_content?.trim() || '';
    if (!content) return <span className="text-muted-foreground">содержимое не задано</span>;
    if (/<[a-zA-Z]/.test(content)) {
      return (
        <span
          className="prose prose-invert prose-a:text-primary prose-a:underline prose-a:break-all max-w-none inline"
          dangerouslySetInnerHTML={{ __html: content }}
            />
      );
    }
    if (isUrl(content)) {
      return (
        <a href={content} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all hover:opacity-90">
          {content}
        </a>
      );
    }
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  };

  const imgSrc = data.product_image
    ? (data.product_image.startsWith('http') || data.product_image.startsWith('/')
        ? data.product_image
        : `/uploads/${data.product_image}`)
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-medium">
        <ArrowLeft size={20} /> Назад
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm"
      >
        <div className="h-12 bg-primary flex items-center px-6">
          <h2 className="text-white font-bold">Выдача товара</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg max-w-lg">
            <Link
              to={`/products/${data.product_id}`}
              className="shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-[var(--muted)] flex items-center justify-center no-underline ring-1 ring-[var(--border)]"
              style={{ textDecoration: 'none' }}
            >
              {imgSrc ? (
                <img src={imgSrc} alt="" className="w-full h-full object-cover object-center" />
              ) : (
                <span className="text-muted-foreground text-[10px] font-bold uppercase text-center px-2">Фото</span>
              )}
            </Link>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <Link
                to={`/products/${data.product_id}`}
                className="font-bold text-base text-primary line-clamp-2 no-underline hover:opacity-90 transition-opacity"
                style={{ textDecoration: 'none' }}
              >
                {data.product_name}
              </Link>
              <Link
                to={`/products/${data.product_id}`}
                className="mt-3 inline-flex items-center justify-center rounded-xl px-5 py-2.5 w-fit transition-colors shadow-md text-sm font-black no-underline hover:opacity-95"
                style={{
                  textDecoration: 'none',
                  backgroundColor: '#1e40af',
                  color: '#fff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              >
                {data.product_price != null ? `${data.product_price} ₽` : 'Товар'}
              </Link>
            </div>
          </div>
          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-sm text-foreground">
              <span className="font-semibold text-muted-foreground">Товар: </span>
              {renderProductContent()}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
