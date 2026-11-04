'use client';
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

type Tone = 'ok' | 'error' | 'info';
interface ToastItem { id: number; text: string; tone: Tone }
const Ctx = createContext<{ show: (text: string, tone?: Tone) => void } | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: Tone = 'info') => {
    const id = seq++;
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={`fade-in pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-lg ${
            t.tone === 'error' ? 'border-danger bg-surface text-danger' : t.tone === 'ok' ? 'border-success bg-surface text-ink' : 'border-line bg-surface text-ink'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast outside ToastProvider');
  return c;
}
