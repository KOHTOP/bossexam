import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/privacy_policy')
      .then(res => res.json())
      .then(data => {
        setContent(data.value);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64">Загрузка...</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)] p-8 md:p-12 rounded-3xl border border-[var(--border)] shadow-sm"
    >
      <div className="flex items-center gap-4 mb-8 text-primary">
        <Shield size={32} />
        <h1 className="text-3xl font-bold font-display tracking-tight">Политика конфиденциальности</h1>
      </div>
      <div className="markdown-body">
        <Markdown>{content}</Markdown>
      </div>
      <section className="mt-10 pt-8 border-t border-[var(--border)]">
        <h2 className="text-xl font-bold font-display mb-4">Использование cookies</h2>
        <p className="text-muted-foreground leading-relaxed">
          Сайт использует файлы cookie для обеспечения работы сервисов (авторизация, корзина, предпочтения). 
          Мы не передаём данные cookie третьим лицам в рекламных целях. Вы можете отключить cookie в настройках браузера, 
          однако часть функций сайта может перестать работать. Продолжая пользоваться сайтом после нажатия «Принять» в уведомлении о cookies, 
          вы соглашаетесь с их использованием в соответствии с настоящей политикой.
        </p>
      </section>
    </motion.div>
  );
};
