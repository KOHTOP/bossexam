import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string | null;
  category: string;
}

export const ProductEmbed: React.FC<{ id: number }> = ({ id }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        if (!cancelled) setProduct(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <span className="text-muted-foreground text-sm">[Товар не найден]</span>;
  if (!product) return <span className="inline-block w-48 h-24 rounded-xl bg-[var(--muted)] animate-pulse" />;

  const imgSrc = product.image
    ? (product.image.startsWith('http') || product.image.startsWith('/')
        ? product.image
        : `/uploads/${product.image}`)
    : null;

  return (
    <div className="product-embed my-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/50 max-w-md">
      <Link
        to={`/products/${product.id}`}
        className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-[var(--muted)] flex items-center justify-center no-underline"
        style={{ textDecoration: 'none' }}
      >
        {imgSrc ? (
          <img src={imgSrc} alt="" className="w-full h-full object-cover object-center" />
        ) : (
          <span className="text-muted-foreground text-[10px] font-bold uppercase text-center">Фото</span>
        )}
      </Link>
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <Link
          to={`/products/${product.id}`}
          className="font-bold text-sm text-foreground line-clamp-2 no-underline hover:opacity-90 transition-opacity"
          style={{ textDecoration: 'none' }}
        >
          {product.name}
        </Link>
        <Link
          to={`/products/${product.id}`}
          className="mt-2 inline-flex items-center justify-center rounded-xl px-4 py-2 w-fit transition-colors shadow-md text-sm font-black no-underline hover:opacity-95"
          style={{
            textDecoration: 'none',
            backgroundColor: '#1e40af',
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          {product.price} ₽
        </Link>
      </div>
    </div>
  );
};
