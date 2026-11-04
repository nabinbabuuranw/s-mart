import Link from 'next/link';
import { ReactNode } from 'react';
import { IconAlert } from './Icons';

export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2';
export const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-soft disabled:opacity-50';
export const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-full border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-surface disabled:opacity-50';
export const inputCls = 'mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60';
export const cardCls = 'rounded-2xl border border-line bg-surface';

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? <p id={id + '-error'} className="mt-1 text-xs text-danger" role="alert">{error}</p> : null}
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-text">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} aria-hidden="true" />;
}

export function GridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="space-y-3"><Skeleton className="aspect-square w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className={`${cardCls} flex flex-col items-start gap-3 p-6`}>
      <div className="flex items-center gap-2 text-danger"><IconAlert className="h-5 w-5" /><span className="font-medium">{message}</span></div>
      {onRetry ? <button onClick={onRetry} className={btnGhost}>Try again</button> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { label: string; href: string } }) {
  return (
    <div className={`${cardCls} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
      <h2 className="text-xl font-semibold">{title}</h2>
      {body ? <p className="max-w-md text-sm text-muted">{body}</p> : null}
      {action ? <Link href={action.href} className={btnPrimary}>{action.label}</Link> : null}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="border-b border-line bg-accent-soft px-4 py-2 text-center text-xs font-medium text-accent-text">
      DEMO STORE: seeded test products, not for sale.
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: 'neutral' | 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  const cls = tone === 'ok' ? 'bg-success/10 text-success' : tone === 'warn' ? 'bg-accent-soft text-accent-text' : tone === 'bad' ? 'bg-danger/10 text-danger' : 'bg-soft text-ink';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      <button className={btnGhost} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="text-sm text-muted">Page {page} of {pages}</span>
      <button className={btnGhost} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}
