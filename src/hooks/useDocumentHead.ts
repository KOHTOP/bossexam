import { useEffect } from 'react';

const SITE_NAME = 'BossExam';

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useDocumentHead(
  title: string,
  description?: string,
  image?: string
) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    const desc = (description || 'Статьи и материалы для подготовки к экзаменам. BossExam — база решений и учебных материалов для студентов.').slice(0, 160);
    setMeta('description', desc);
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', desc, true);
    setMeta('og:type', 'website', true);
    setMeta('og:url', window.location.href, true);

    const img = image || `${window.location.origin}/icon.png`;
    setMeta('og:image', img.startsWith('http') ? img : `${window.location.origin}${img.startsWith('/') ? '' : '/'}${img}`, true);

    return () => {
      // Optional: restore default on unmount if needed
    };
  }, [title, description, image]);
}

export const DEFAULT_TITLES: Record<string, string> = {
  '/': 'Главная',
  '/products': 'Товары',
  '/profile': 'Профиль',
  '/auth': 'Вход',
  '/privacy': 'Политика конфиденциальности',
  '/terms': 'Пользовательское соглашение',
  '/topup': 'Пополнение баланса',
  '/topup/success': 'Успешное пополнение',
  '/admin': 'Админ-панель',
  '/notifications': 'Оповещения',
  '/article': 'Статья',
  '/author': 'Автор',
};

export const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  '/': 'BossExam — база статей и материалов для подготовки к экзаменам. Найди ответы на экзаменационные вопросы, учебные материалы и товары для студентов.',
  '/products': 'Каталог товаров и материалов для учёбы. Платные материалы и курсы на BossExam.',
  '/profile': 'Личный кабинет: покупки, баланс и настройки профиля BossExam.',
  '/auth': 'Вход и регистрация на BossExam.',
  '/privacy': 'Политика конфиденциальности BossExam.',
  '/terms': 'Пользовательское соглашение BossExam.',
  '/topup': 'Пополнить баланс для покупок на BossExam.',
  '/topup/success': 'Баланс успешно пополнен.',
  '/admin': 'Панель администратора BossExam.',
  '/notifications': 'Оповещения для администраторов BossExam.',
};

export function getDefaultSEO(pathname: string): { title: string; description: string } {
  const parts = pathname.split('/').filter(Boolean);
  const base = '/' + (parts[0] || '');
  const title = DEFAULT_TITLES[pathname] ?? DEFAULT_TITLES[base] ?? 'BossExam';
  const description = DEFAULT_DESCRIPTIONS[pathname] ?? DEFAULT_DESCRIPTIONS[base] ?? DEFAULT_DESCRIPTIONS['/'];
  return { title, description };
}
