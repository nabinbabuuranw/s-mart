'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { IconBell, IconCart, IconClose, IconMenu, IconMoon, IconSearch, IconSun, IconUser } from './Icons';

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      <Footer />
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')); }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('smart-theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
    setDark(next);
  };
  return (
    <button onClick={toggle} className="rounded-full p-2 text-ink hover:bg-soft" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} aria-pressed={dark}>
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    api<any>('/me/notifications?pageSize=1', { quiet: true }).then((j) => setUnread(j.unread || 0)).catch(() => setUnread(0));
  }, [user]);
  useRealtime({ private: true, enabled: !!user }, (type) => {
    if (type === 'order.updated' || type === 'ticket.reply') {
      api<any>('/me/notifications?pageSize=1', { quiet: true }).then((j) => setUnread(j.unread || 0)).catch(() => {});
    }
  });

  const links = [
    { href: '/products', label: 'Shop' },
    { href: '/products?onOffer=true', label: 'Offers' },
    { href: '/products?sort=newest', label: 'New' },
  ];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/products' + (q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''));
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-6 md:px-6">
        <button className="rounded-full p-2 hover:bg-soft md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
          {open ? <IconClose /> : <IconMenu />}
        </button>
        <Link href="/" className="flex items-center gap-2" aria-label="S Mart home">
          <img src="/brand/logo-mark.png" alt="S Mart" width={120} height={121} className="h-9 w-auto" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-5 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-ink hover:text-accent-text">{l.label}</Link>
          ))}
        </nav>
        <form onSubmit={submit} role="search" className="ml-auto hidden max-w-xs flex-1 md:block">
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input id="site-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products"
              className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/products" className="rounded-full p-2 hover:bg-soft md:hidden" aria-label="Search"><IconSearch /></Link>
          <ThemeToggle />
          {user ? (
            <Link href="/account/notifications" className="relative rounded-full p-2 hover:bg-soft" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <IconBell />
              {unread > 0 ? <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-[18px] text-ink">{unread > 99 ? '99+' : unread}</span> : null}
            </Link>
          ) : null}
          <Link href="/cart" className="relative rounded-full p-2 hover:bg-soft" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
            <IconCart />
            {count > 0 ? <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-on-primary">{count}</span> : null}
          </Link>
          {user ? (
            <Link href="/account" className="hidden rounded-full p-2 hover:bg-soft sm:block" aria-label="Your account"><IconUser /></Link>
          ) : (
            <Link href="/login" className="ml-1 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:bg-soft">Sign in</Link>
          )}
        </div>
      </div>
      {open ? (
        <div id="mobile-nav" className="border-t border-line bg-paper px-4 py-4 md:hidden">
          <form onSubmit={submit} role="search" className="mb-4">
            <label htmlFor="mobile-search" className="sr-only">Search products</label>
            <input id="mobile-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm" />
          </form>
          <ul className="space-y-1">
            {links.map((l) => <li key={l.href}><Link href={l.href} className="block rounded-lg px-3 py-2.5 font-medium hover:bg-soft">{l.label}</Link></li>)}
            {user ? (
              <>
                <li><Link href="/account" className="block rounded-lg px-3 py-2.5 font-medium hover:bg-soft">My account</Link></li>
                <li><button onClick={async () => { await logout(); router.push('/'); }} className="block w-full rounded-lg px-3 py-2.5 text-left font-medium hover:bg-soft">Sign out</button></li>
              </>
            ) : <li><Link href="/login" className="block rounded-lg px-3 py-2.5 font-medium hover:bg-soft">Sign in</Link></li>}
          </ul>
        </div>
      ) : null}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
        <div>
          <img src="/brand/logo-mark.png" alt="S Mart" width={120} height={121} className="h-9 w-auto" />
          <p className="mt-3 max-w-xs text-sm text-muted">Everyday stationery, kitchen and home goods. Pay in cash when your order arrives.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-2 text-sm">
          <Link href="/products" className="hover:text-accent-text">Shop all</Link>
          <Link href="/account/orders" className="hover:text-accent-text">Track an order</Link>
          <Link href="/account/support" className="hover:text-accent-text">Help and support</Link>
          <Link href="/account" className="hover:text-accent-text">Your account</Link>
        </nav>
        <p className="text-xs text-muted md:text-right">
          This is a demo store. Products marked DEMO are seeded test items, not for sale. Payment is cash on delivery only.
        </p>
      </div>
    </footer>
  );
}
