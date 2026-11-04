'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, errorText, money } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/Toast';
import { IconMinus, IconPlus, IconTrash } from '@/components/Icons';
import { EmptyState, Skeleton, btnPrimary, btnGhost, cardCls } from '@/components/ui';
import { ProductImage } from '@/components/ProductImage';

export default function CartPage() {
  const { user, loading } = useAuth();
  const { cart, reload, setCart } = useCart();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-8 w-40" /><div className="mt-6 space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div></div>;
  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold">Your cart</h1>
      <p className="mt-2 text-muted">Sign in to keep your cart and check out. Your items will be here when you sign in.</p>
      <Link href="/login?next=/cart" className={`${btnPrimary} mt-6`}>Sign in</Link>
    </div>
  );

  const change = async (variantId: string, quantity: number, name: string) => {
    setPending(variantId);
    try {
      const next = await api(`/me/cart/items/${variantId}`, { method: 'PUT', body: { quantity } });
      if (next && typeof next === 'object' && 'items' in next) setCart(next as any); else await reload();
      if (quantity === 0) toast.show(`Removed ${name}`, 'ok');
    } catch (e) { toast.show(errorText(e), 'error'); await reload(); }
    finally { setPending(null); }
  };
  const clear = async () => {
    if (!confirm('Empty your cart?')) return;
    try { await api('/me/cart', { method: 'DELETE' }); await reload(); toast.show('Cart emptied', 'ok'); }
    catch (e) { toast.show(errorText(e), 'error'); }
  };

  if (!cart.items.length) return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6"><h1 className="mb-6 text-3xl font-semibold">Your cart</h1>
      <EmptyState title="Your cart is empty" body="Find something you need. Totals are worked out by the store when you check out." action={{ label: 'Start shopping', href: '/products' }} /></div>
  );

  const hasProblem = cart.items.some((i) => !i.available || i.quantity > (i.stock ?? 99));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold md:text-4xl">Your cart</h1>
        <button onClick={clear} className="text-sm text-muted underline underline-offset-4 hover:text-danger">Empty cart</button>
      </div>
      <div className="grid gap-8 md:grid-cols-[1fr_340px]">
        <ul className="space-y-3" aria-label="Items in your cart">
          {cart.items.map((i) => (
            <li key={i.id} className={`${cardCls} flex gap-4 p-4 fade-in ${pending === i.variantId ? 'opacity-60' : ''}`}>
              <Link href={`/products/${i.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-soft">
                <ProductImage src={i.image} alt="" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div>
                  <Link href={`/products/${i.slug}`} className="font-medium hover:underline">{i.name}</Link>
                  {i.variantName && i.variantName !== 'Default' ? <p className="text-sm text-muted">{i.variantName}</p> : null}
                  <p className="text-sm">{money(i.unitPrice)} each{i.offerTitle ? <span className="ml-2 text-xs text-accent-text">{i.offerTitle}</span> : null}</p>
                  {!i.available ? <p className="text-sm text-danger" role="status">No longer available. Remove it to check out.</p> : null}
                  {i.available && i.stock != null && i.quantity > i.stock ? <p className="text-sm text-danger" role="status">Only {i.stock} left.</p> : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-full border border-line" role="group" aria-label={`Quantity for ${i.name}`}>
                    <button className="p-2.5 hover:bg-soft disabled:opacity-40" disabled={pending === i.variantId || i.quantity <= 1} onClick={() => change(i.variantId, i.quantity - 1, i.name)} aria-label="Decrease quantity"><IconMinus className="h-4 w-4" /></button>
                    <span className="min-w-[2rem] text-center text-sm font-medium" aria-live="polite">{i.quantity}</span>
                    <button className="p-2.5 hover:bg-soft disabled:opacity-40" disabled={pending === i.variantId || i.quantity >= 99} onClick={() => change(i.variantId, i.quantity + 1, i.name)} aria-label="Increase quantity"><IconPlus className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{money(i.lineTotal)}</span>
                    <button className="inline-flex items-center gap-1 text-sm text-muted hover:text-danger" onClick={() => change(i.variantId, 0, i.name)}><IconTrash className="h-4 w-4" />Remove</button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside aria-labelledby="summary" className={`${cardCls} h-fit space-y-3 p-6`}>
          <h2 id="summary" className="text-lg font-semibold">Summary</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Subtotal" v={money(cart.subtotal)} />
            {cart.discountTotal ? <Row k="Discounts" v={'−' + money(cart.discountTotal)} /> : null}
            {cart.couponDiscount ? <Row k="Coupon" v={'−' + money(cart.couponDiscount)} /> : null}
            <Row k="Shipping" v={cart.shippingFee ? money(cart.shippingFee) : 'Free'} />
            {cart.taxTotal ? <Row k="Tax" v={money(cart.taxTotal)} /> : null}
          </dl>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd>{money(cart.total)}</dd></div>
          <p className="text-xs text-muted">Cash on delivery. Totals come from the store.</p>
          {hasProblem ? <p className="text-sm text-danger" role="status">Fix the items above before you check out.</p> : null}
          <Link href="/checkout" aria-disabled={hasProblem} className={`${btnPrimary} w-full ${hasProblem ? 'pointer-events-none opacity-50' : ''}`}>Checkout</Link>
          <Link href="/products" className={`${btnGhost} w-full`}>Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>;
}
