'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, dateTime, errorText, money, STATUS_LABEL } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { useToast } from '@/components/Toast';
import { AccountShell } from '@/components/Account';
import { IconCheck, IconTruck } from '@/components/Icons';
import { ErrorState, Field, Skeleton, StatusPill, btnDanger, btnGhost, btnPrimary, cardCls, inputCls } from '@/components/ui';

const CANCELLABLE = ['placed', 'confirmed', 'pending_payment'];
const STEPS = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const placed = useSearchParams().get('placed') === '1';
  const toast = useToast();
  const [o, setO] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [liveNote, setLiveNote] = useState<string>('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [retOpen, setRetOpen] = useState(false);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [retReason, setRetReason] = useState('');
  const [retErr, setRetErr] = useState('');

  useEffect(() => {
    setErr(null);
    api<any>(`/me/orders/${id}`, { quiet: true }).then(setO).catch((e) => setErr(e?.status === 404 ? 'We could not find this order in your account.' : errorText(e)));
  }, [id, tick]);

  useRealtime({ private: true }, (type, data) => {
    if (type === 'order.updated' && data?.orderId === id) {
      setLiveNote(`Status is now ${STATUS_LABEL[data.status] || data.status}.`);
      setTick((t) => t + 1);
    }
  });

  if (err) return <AccountShell title="Order"><ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /><p className="mt-4 text-sm"><Link className="underline" href="/account/orders">Back to orders</Link></p></AccountShell>;
  if (!o) return <AccountShell title="Order"><div className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40" /></div></AccountShell>;

  const idx = STEPS.indexOf(o.status);
  const events = [...(o.events || [])].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const canCancel = CANCELLABLE.includes(o.status);
  const canReturn = o.status === 'delivered' && !(o.returns || []).some((r: any) => ['requested', 'approved', 'received'].includes(r.status));
  const paid = o.paymentStatus === 'paid';

  const cancel = async () => {
    setBusy(true);
    try {
      await api(`/me/orders/${o.id}/cancel`, { method: 'POST', body: reason.trim() ? { reason: reason.trim() } : {} });
      setCancelOpen(false); setReason(''); setTick((t) => t + 1); toast.show('Order cancelled', 'ok');
    } catch (e) { toast.show(errorText(e), 'error'); }
    finally { setBusy(false); }
  };
  const requestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(retQty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!items.length) { setRetErr('Choose at least one item to return.'); return; }
    if (retReason.trim().length < 3) { setRetErr('Tell us briefly why you are returning these.'); return; }
    setBusy(true); setRetErr('');
    try {
      await api(`/me/orders/${o.id}/returns`, { method: 'POST', body: { reason: retReason.trim(), items } });
      setRetOpen(false); setRetQty({}); setRetReason(''); setTick((t) => t + 1); toast.show('Return request sent', 'ok');
    } catch (e) { setRetErr(errorText(e)); }
    finally { setBusy(false); }
  };

  return (
    <AccountShell title={`Order ${o.number}`}>
      {placed ? <p role="status" className="mb-6 flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success"><IconCheck className="h-4 w-4" />Thank you. Your order is placed. You pay the driver in cash on delivery.</p> : null}
      {liveNote ? <p role="status" aria-live="polite" className="mb-4 rounded-xl bg-accent-soft px-4 py-2 text-sm text-accent-text">{liveNote}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={o.status === 'delivered' ? 'ok' : o.status === 'cancelled' ? 'bad' : 'warn'}>{STATUS_LABEL[o.status] || o.status}</StatusPill>
        <span className="text-sm text-muted">Placed {dateTime(o.placedAt || o.createdAt)}</span>
      </div>

      {o.status !== 'cancelled' ? (
        <ol aria-label="Delivery progress" className="mt-6 grid grid-cols-6 gap-1">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-0">
              <div className={`h-1.5 rounded-full ${idx >= i ? 'bg-primary' : 'bg-line'}`} />
              <p className={`mt-2 truncate text-[11px] md:text-xs ${idx >= i ? 'text-ink' : 'text-muted'}`}>{STATUS_LABEL[s]}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {o.shipments?.length ? (
        <div className="mt-6 rounded-xl border border-line p-4 text-sm">
          <p className="flex items-center gap-2 font-medium"><IconTruck className="h-4 w-4" />Shipment</p>
          {o.shipments.map((s: any) => <p key={s.id} className="mt-1 text-muted">{s.carrier}{s.trackingNumber ? ` · tracking ${s.trackingNumber}` : ''}</p>)}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="items-h">
          <h2 id="items-h" className="mb-3 text-lg font-semibold">Items</h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {o.items.map((i: any) => (
              <li key={i.id} className="flex justify-between gap-3 p-3 text-sm">
                <span>{i.quantity} × {i.name}{i.variantName && i.variantName !== 'Default' ? ` (${i.variantName})` : ''}</span>
                <span>{money(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
            {o.discountTotal ? <div className="flex justify-between"><dt className="text-muted">Discounts</dt><dd>−{money(o.discountTotal)}</dd></div> : null}
            {o.couponCode ? <div className="flex justify-between"><dt className="text-muted">Coupon {o.couponCode}</dt><dd>−{money(o.couponDiscount)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{o.shippingFee ? money(o.shippingFee) : 'Free'}</dd></div>
            {o.taxTotal ? <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{money(o.taxTotal)}</dd></div> : null}
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd>{money(o.total)}</dd></div>
            {o.refundedTotal ? <div className="flex justify-between text-success"><dt>Refunded</dt><dd>{money(o.refundedTotal)}</dd></div> : null}
          </dl>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="pay-h" className="rounded-xl border border-line p-4 text-sm">
            <h2 id="pay-h" className="font-semibold">Payment</h2>
            <p className="mt-1 text-muted">Cash on delivery · {paid ? 'Paid on delivery' : 'Pay the driver when it arrives'}</p>
          </section>
          <section aria-labelledby="addr-h" className="rounded-xl border border-line p-4 text-sm">
            <h2 id="addr-h" className="font-semibold">Delivering to</h2>
            <p className="mt-1 text-muted">{o.addressSnapshot?.fullName}<br />{[o.addressSnapshot?.line1, o.addressSnapshot?.line2, o.addressSnapshot?.city].filter(Boolean).join(', ')}<br />{o.addressSnapshot?.phone}</p>
          </section>
        </div>
      </div>

      <section aria-labelledby="tl-h" className="mt-8">
        <h2 id="tl-h" className="mb-3 text-lg font-semibold">Timeline</h2>
        <ol className="space-y-4 border-l border-line pl-5">
          {events.map((e: any) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
              <p className="text-sm font-medium">{e.note || STATUS_LABEL[e.status] || e.status}</p>
              <p className="text-xs text-muted">{dateTime(e.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>

      {o.returns?.length ? (
        <section aria-labelledby="ret-h" className="mt-8">
          <h2 id="ret-h" className="mb-3 text-lg font-semibold">Returns</h2>
          <ul className="space-y-2 text-sm">{o.returns.map((r: any) => <li key={r.id} className="rounded-xl border border-line p-3">Return {STATUS_LABEL[r.status] || r.status}{r.reason ? ` · ${r.reason}` : ''}</li>)}</ul>
        </section>
      ) : null}
      {o.refunds?.length ? (
        <section aria-labelledby="refd-h" className="mt-8">
          <h2 id="refd-h" className="mb-3 text-lg font-semibold">Refunds</h2>
          <ul className="space-y-2 text-sm">{o.refunds.map((r: any) => <li key={r.id} className="rounded-xl border border-line p-3">{money(r.amount)} refunded · {dateTime(r.createdAt)}</li>)}</ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {canCancel && !cancelOpen ? <button className={btnDanger} onClick={() => setCancelOpen(true)}>Cancel order</button> : null}
        {canReturn && !retOpen ? <button className={btnGhost} onClick={() => setRetOpen(true)}>Request a return</button> : null}
        <Link href="/account/support" className={btnGhost}>Get help with this order</Link>
      </div>

      {cancelOpen ? (
        <div className={`${cardCls} mt-6 max-w-lg space-y-4 p-5`} role="dialog" aria-modal="false" aria-labelledby="cancel-h">
          <h2 id="cancel-h" className="font-semibold">Cancel this order?</h2>
          <p className="text-sm text-muted">Nothing is charged, because you pay on delivery. You can order again any time.</p>
          <Field id="cancel-reason" label="Reason (optional)"><input id="cancel-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
          <div className="flex gap-3">
            <button className={btnDanger} onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel order'}</button>
            <button className={btnGhost} onClick={() => setCancelOpen(false)}>Keep order</button>
          </div>
        </div>
      ) : null}

      {retOpen ? (
        <form onSubmit={requestReturn} className={`${cardCls} mt-6 max-w-lg space-y-4 p-5`} noValidate>
          <h2 className="font-semibold">Request a return</h2>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Items and quantity</legend>
            {o.items.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{i.name}</span>
                <label className="flex items-center gap-2 text-muted">Qty
                  <input type="number" min={0} max={i.quantity} value={retQty[i.id] || 0} onChange={(e) => setRetQty({ ...retQty, [i.id]: Math.min(i.quantity, Math.max(0, Number(e.target.value) || 0)) })} className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-ink" aria-label={`Quantity to return for ${i.name}, up to ${i.quantity}`} />
                </label>
              </div>
            ))}
          </fieldset>
          <Field id="ret-reason" label="Why are you returning these?"><textarea id="ret-reason" rows={3} className={inputCls} value={retReason} onChange={(e) => setRetReason(e.target.value)} maxLength={1000} /></Field>
          {retErr ? <p role="alert" className="text-sm text-danger">{retErr}</p> : null}
          <div className="flex gap-3"><button className={btnPrimary} disabled={busy}>{busy ? 'Sending…' : 'Send return request'}</button><button type="button" className={btnGhost} onClick={() => setRetOpen(false)}>Close</button></div>
        </form>
      ) : null}
    </AccountShell>
  );
}
