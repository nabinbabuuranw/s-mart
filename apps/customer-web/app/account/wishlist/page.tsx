'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorText, money } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/Toast';
import { AccountShell } from '@/components/Account';
import { EmptyState, ErrorState, Skeleton, btnGhost, btnPrimary } from '@/components/ui';

export default function WishlistPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { reload } = useCart();
  const toast = useToast();
  useEffect(() => { setErr(null); api<any>('/me/wishlist', { quiet: true }).then((l) => setItems(Array.isArray(l) ? l : l?.items || [])).catch((e) => setErr(errorText(e))); }, [tick]);

  const remove = async (productId: string) => {
    try { await api(`/me/wishlist/${productId}`, { method: 'DELETE' }); setItems((xs) => (xs || []).filter((x) => (x.productId ?? x.id ?? x.product?.id) !== productId)); toast.show('Removed from wishlist', 'ok'); }
    catch (e) { toast.show(errorText(e), 'error'); }
  };
  const addToCart = async (variantId: string) => {
    try { await api('/me/cart/items', { method: 'POST', body: { variantId, quantity: 1 } }); await reload(); toast.show('Added to cart', 'ok'); }
    catch (e) { toast.show(errorText(e), 'error'); }
  };

  return (
    <AccountShell title="Your wishlist">
      {err ? <ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /> : null}
      {!items && !err ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : null}
      {items && !items.length ? <EmptyState title="Nothing saved yet" body="Tap the heart on a product to keep it here." action={{ label: 'Browse products', href: '/products' }} /> : null}
      {items?.length ? (
        <ul className="divide-y divide-line">
          {items.map((x) => {
            const p = x.product || x;
            const pid = x.productId ?? p.id;
            const v = p.variants?.find((vv: any) => vv.available) || p.variants?.[0];
            return (
              <li key={pid} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link href={`/products/${p.slug}`} className="font-medium hover:underline">{p.name}</Link>
                  {v ? <p className="text-sm text-muted">{money(v.price)}{v.available ? '' : ' · out of stock'}</p> : null}
                </div>
                <div className="flex gap-2">
                  {v?.available ? <button className={btnPrimary} onClick={() => addToCart(v.id)}>Add to cart</button> : null}
                  <button className={btnGhost} onClick={() => remove(pid)}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </AccountShell>
  );
}
