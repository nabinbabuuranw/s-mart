'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, errorText, money } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/Toast';
import { Field, EmptyState, ErrorState, Skeleton, btnPrimary, btnGhost, cardCls, inputCls } from '@/components/ui';

const BLANK = { label: 'Home', fullName: '', phone: '', line1: '', line2: '', city: '', district: '', province: '', postalCode: '' };

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { cart, reload } = useCart();
  const router = useRouter();
  const toast = useToast();
  const [addresses, setAddresses] = useState<any[] | null>(null);
  const [addrErr, setAddrErr] = useState(false);
  const [methods, setMethods] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [coupon, setCoupon] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  // One idempotency key per checkout attempt; reused on retry, renewed only after a new cart/address choice succeeds.
  const idem = useRef<string>('');
  if (!idem.current) idem.current = crypto.randomUUID();

  const loadAddresses = () => {
    setAddrErr(false);
    api<any[]>('/me/addresses', { quiet: true }).then((list) => {
      setAddresses(list);
      const def = list.find((a) => a.isDefault) || list[0];
      setAddressId((cur) => cur || def?.id || '');
    }).catch(() => setAddrErr(true));
  };
  useEffect(() => { if (user) { loadAddresses(); api<any[]>('/payment-methods', { quiet: true }).then(setMethods).catch(() => setMethods([])); } }, [user]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-8 w-40" /></div>;
  if (!user) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold">Sign in to check out</h1>
      <p className="mt-2 text-muted">Your cart is saved to your account.</p>
      <Link href="/login?next=/checkout" className={`${btnPrimary} mt-6`}>Sign in</Link>
    </div>
  );
  if (!cart.items.length && !submitting) return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState title="Your cart is empty" body="Add something before you check out." action={{ label: 'Shop', href: '/products' }} /></div>;

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.fullName.trim()) err.fullName = 'Enter the name for delivery.';
    if (!/^[0-9+ ()-]{7,20}$/.test(form.phone.trim())) err.phone = 'Enter a phone number we can call.';
    if (!form.line1.trim()) err.line1 = 'Enter the street or area.';
    if (!form.city.trim()) err.city = 'Enter the city or town.';
    setFormErr(err);
    if (Object.keys(err).length) return;
    try {
      const body: any = { label: form.label || 'Home', fullName: form.fullName.trim(), phone: form.phone.trim(), line1: form.line1.trim(), city: form.city.trim(), isDefault: !addresses?.length };
      ['line2', 'district', 'province', 'postalCode'].forEach((k) => { const v = (form as any)[k]?.trim(); if (v) body[k] = v; });
      const created = await api<any>('/me/addresses', { method: 'POST', body });
      setAdding(false); setForm({ ...BLANK });
      setAddresses((xs) => [...(xs || []), created]); setAddressId(created.id);
      toast.show('Address saved', 'ok');
    } catch (ex) { setFormError(errorText(ex)); }
  };

  const place = async () => {
    if (!addressId) { setFormError('Choose or add a delivery address first.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const body: any = { addressId, paymentMethod: 'cod' };
      if (coupon.trim()) body.couponCode = coupon.trim().toUpperCase();
      if (note.trim()) body.note = note.trim();
      const order = await api<any>('/checkout', { method: 'POST', body, headers: { 'Idempotency-Key': idem.current } });
      await reload();
      toast.show('Order placed. Cash on delivery.', 'ok');
      idem.current = crypto.randomUUID();
      router.push(`/account/orders/${order.id}?placed=1`);
    } catch (ex: any) {
      setFormError(ex?.status === 409 ? 'Some items changed while you were checking out. Review your cart and try again.' : errorText(ex));
      setSubmitting(false);
    }
  };

  const cod = methods.find((m) => m.id === 'cod');
  const others = methods.filter((m) => m.id !== 'cod');
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="mb-6 text-3xl font-semibold md:text-4xl">Checkout</h1>
      <div className="grid gap-8 md:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className={`${cardCls} p-6`} aria-labelledby="addr-h">
            <h2 id="addr-h" className="text-lg font-semibold">Delivery address</h2>
            {addrErr ? <div className="mt-4"><ErrorState message="We could not load your addresses." onRetry={loadAddresses} /></div> : null}
            {!addresses && !addrErr ? <div className="mt-4 space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : null}
            {addresses?.length ? (
              <fieldset className="mt-4 space-y-2">
                <legend className="sr-only">Choose a delivery address</legend>
                {addresses.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${addressId === a.id ? 'border-ink' : 'border-line'}`}>
                    <input type="radio" name="address" className="mt-1 accent-[var(--primary)]" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="text-sm">
                      <span className="font-medium">{a.label}: {a.fullName}</span><br />
                      <span className="text-muted">{[a.line1, a.line2, a.city, a.district, a.province].filter(Boolean).join(', ')} · {a.phone}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {addresses && !addresses.length && !adding ? <p className="mt-3 text-sm text-muted">No saved address yet. Add one to continue.</p> : null}
            {!adding ? <button onClick={() => setAdding(true)} className={`${btnGhost} mt-4`}>{addresses?.length ? 'Add another address' : 'Add address'}</button> : (
              <form onSubmit={saveAddress} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field id="fullName" label="Full name" error={formErr.fullName}><input id="fullName" autoComplete="name" className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
                <Field id="phone" label="Phone" error={formErr.phone} hint="For the delivery person to call."><input id="phone" type="tel" autoComplete="tel" className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <div className="sm:col-span-2"><Field id="line1" label="Street or area" error={formErr.line1}><input id="line1" autoComplete="address-line1" className={inputCls} value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} /></Field></div>
                <Field id="line2" label="Landmark or line 2 (optional)"><input id="line2" className={inputCls} value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></Field>
                <Field id="city" label="City or town" error={formErr.city}><input id="city" autoComplete="address-level2" className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                <Field id="district" label="District (optional)"><input id="district" className={inputCls} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
                <Field id="label" label="Label"><input id="label" className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <button type="submit" className={btnPrimary}>Save address</button>
                  <button type="button" onClick={() => { setAdding(false); setFormErr({}); }} className={btnGhost}>Cancel</button>
                </div>
              </form>
            )}
          </section>

          <section className={`${cardCls} p-6`} aria-labelledby="pay-h">
            <h2 id="pay-h" className="text-lg font-semibold">Payment</h2>
            <div className="mt-4 rounded-xl border border-ink bg-soft p-4">
              <p className="font-medium">Cash on delivery</p>
              <p className="mt-1 text-sm text-muted">{cod?.enabled === false ? 'Currently unavailable.' : 'Pay the driver in cash when your order arrives. The order shows as paid once it is delivered.'}</p>
            </div>
            {others.length ? (
              <ul className="mt-3 space-y-2">
                {others.map((m) => <li key={m.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm text-muted"><span>{m.label}</span><span>Not enabled yet</span></li>)}
              </ul>
            ) : null}
          </section>

          <section className={`${cardCls} p-6`} aria-labelledby="extra-h">
            <h2 id="extra-h" className="text-lg font-semibold">Coupon and note</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="coupon" label="Coupon code" hint="Applied when you place the order."><input id="coupon" className={inputCls + ' uppercase'} value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={32} /></Field>
              <Field id="note" label="Note for the store (optional)"><input id="note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
            </div>
          </section>
        </div>

        <aside aria-labelledby="sum-h" className={`${cardCls} h-fit space-y-3 p-6`}>
          <h2 id="sum-h" className="text-lg font-semibold">Order total</h2>
          <ul className="max-h-60 space-y-2 overflow-auto text-sm">
            {cart.items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span className="text-muted">{i.quantity} × {i.name}</span><span>{money(i.lineTotal)}</span></li>)}
          </ul>
          <dl className="space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
            {cart.discountTotal ? <div className="flex justify-between"><dt className="text-muted">Discounts</dt><dd>−{money(cart.discountTotal)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{cart.shippingFee ? money(cart.shippingFee) : 'Free'}</dd></div>
            {cart.taxTotal ? <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{money(cart.taxTotal)}</dd></div> : null}
          </dl>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><span>To pay on delivery</span><span>{money(cart.total)}</span></div>
          {formError ? <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p> : null}
          <button onClick={place} disabled={submitting || !addressId || !cart.items.length} className={`${btnPrimary} w-full`} aria-busy={submitting}>
            {submitting ? 'Placing order…' : 'Place order (cash on delivery)'}
          </button>
          <p className="text-xs text-muted">By placing this order you agree to the store's terms. Totals are calculated by the store.</p>
        </aside>
      </div>
    </div>
  );
}
