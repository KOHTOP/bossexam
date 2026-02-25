import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { motion } from 'motion/react';
import { FileText } from 'lucide-react';

export const TermsPage: React.FC = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/user_agreement')
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
        <FileText size={32} />
        <h1 className="text-3xl font-bold font-display tracking-tight">Пользовательское соглашение</h1>
      </div>
      <div className="markdown-body">
        <Markdown remarkPlugins={[remarkBreaks]}>{content}</Markdown>
      </div>
    </motion.div>
  );
};
