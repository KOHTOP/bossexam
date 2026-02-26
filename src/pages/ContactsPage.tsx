import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mail, MessageCircle } from 'lucide-react';
import { useDocumentHead } from '../hooks/useDocumentHead';

export const ContactsPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [loading, setLoading] = useState(true);

  useDocumentHead('Контакты', 'Контактная информация и связь с командой BossExam. Реквизиты, обратная связь.');

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/contact_email').then((r) => r.json()).then((d) => d.value || ''),
      fetch('/api/settings/contact_telegram').then((r) => r.json()).then((d) => d.value || ''),
    ])
      .then(([e, t]) => {
        setEmail(e);
        setTelegram(t);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)] p-8 md:p-12 rounded-3xl border border-[var(--border)] shadow-sm"
    >
      <h1 className="text-3xl font-bold font-display tracking-tight mb-2">Контакты</h1>
      <p className="text-muted-foreground mb-8">
        По вопросам сотрудничества, размещения материалов и технической поддержки свяжитесь с нами.
      </p>
      <div className="space-y-6">
        {email && (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Mail size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <a href={`mailto:${email}`} className="text-lg font-medium text-primary hover:underline">
                {email}
              </a>
            </div>
          </div>
        )}
        {telegram && (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MessageCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Telegram</p>
              <a
                href={telegram.startsWith('http') ? telegram : `https://t.me/${telegram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-medium text-primary hover:underline"
              >
                {telegram.startsWith('http') ? telegram : `@${telegram.replace(/^@/, '')}`}
              </a>
            </div>
          </div>
        )}
        {!email && !telegram && (
          <p className="text-muted-foreground">
            Контактные данные настраиваются администратором. По вопросам используйте форму обратной связи в личном кабинете или раздел «Отзывы».
          </p>
        )}
      </div>
      <section className="mt-10 pt-8 border-t border-[var(--border)]">
        <h2 className="text-xl font-bold font-display mb-4">Доверие и прозрачность</h2>
        <p className="text-muted-foreground leading-relaxed">
          BossExam — образовательный проект. Мы указываем актуальные контакты, политику конфиденциальности и пользовательское соглашение. 
          Оплата материалов производится через платёжную систему с соблюдением требований законодательства.
        </p>
      </section>
    </motion.div>
  );
};
