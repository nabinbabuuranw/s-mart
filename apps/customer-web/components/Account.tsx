'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Skeleton, cardCls, btnPrimary } from './ui';

/** Renders children only for a signed-in customer; otherwise a clear sign-in prompt. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/login?next=' + encodeURIComponent(pathname)); }, [loading, user, pathname, router]);
  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10 md:px-6"><Skeleton className="h-8 w-48" /><div className="mt-6 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>;
  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Sign in to see this</h1>
      <p className="mt-2 text-sm text-muted">Your orders, addresses and support live in your account.</p>
      <Link href={'/login?next=' + encodeURIComponent(pathname)} className={`${btnPrimary} mt-6`}>Sign in</Link>
    </div>
  );
  return <>{children}</>;
}

const NAV = [
  { href: '/account', label: 'Profile' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/wishlist', label: 'Wishlist' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/payments', label: 'Payments' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/support', label: 'Support' },
];

export function AccountShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <nav aria-label="Account" className="flex gap-1 overflow-x-auto md:flex-col">
            {NAV.map((n) => {
              const active = n.href === '/account' ? pathname === '/account' : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium md:rounded-xl ${active ? 'bg-primary text-on-primary' : 'text-ink hover:bg-soft'}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <section className={`min-w-0 fade-in ${cardCls} p-5 md:p-8`} aria-labelledby="account-title">
            <h1 id="account-title" className="mb-6 font-display text-2xl font-semibold">{title}</h1>
            {children}
          </section>
        </div>
      </div>
    </RequireAuth>
  );
}
