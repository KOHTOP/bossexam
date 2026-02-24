import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setVisible(false), 500);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-[var(--background)] flex flex-col items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-6"
          >
            <img src="/icon.png" alt="" className="h-16 w-16 rounded-2xl shadow-2xl shadow-primary/40 object-contain" aria-hidden />
            <h1 className="text-4xl font-bold font-display tracking-tighter">BossExam</h1>
            
            <div className="w-64 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden border border-[var(--border)]">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-[0.2em]">
              Загрузка базы данных... {Math.round(progress)}%
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
