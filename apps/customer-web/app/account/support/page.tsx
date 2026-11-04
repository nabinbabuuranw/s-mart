'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, dateTime, errorText, STATUS_LABEL } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { AccountShell } from '@/components/Account';
import { EmptyState, ErrorState, Field, Skeleton, StatusPill, btnPrimary, btnGhost, inputCls } from '@/components/ui';

const TSTATUS: Record<string, string> = { open: 'Open', pending: 'Waiting on us', resolved: 'Resolved', closed: 'Closed' };

export default function SupportPage() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ subject: '', body: '', orderNumber: '' });
  const [fe, setFe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState('');
  useEffect(() => { setErr(null); api<any>('/me/tickets', { quiet: true }).then((j) => setList(Array.isArray(j) ? j : j?.items || [])).catch((e) => setErr(errorText(e))); }, [tick]);
  useEffect(() => { if (creating && !orders.length) api<any>('/me/orders?pageSize=20', { quiet: true }).then((j) => setOrders(j.items || [])).catch(() => {}); }, [creating]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (f.subject.trim().length < 3) x.subject = 'Give the question a short subject.';
    if (f.body.trim().length < 5) x.body = 'Tell us a little more so we can help.';
    setFe(x); if (Object.keys(x).length) return;
    setBusy(true);
    try {
      const t = await api<any>('/me/tickets', { method: 'POST', body: { subject: f.subject.trim(), body: f.body.trim(), ...(orderId ? { orderId } : {}) } });
      setCreating(false); setF({ subject: '', body: '', orderNumber: '' }); setOrderId('');
      toast.show('Ticket sent. We will reply here.', 'ok');
      setTick((t2) => t2 + 1);
      if (t?.id) window.location.href = `/account/support/${t.id}`;
    } catch (ex) { setFe({ form: errorText(ex) }); }
    finally { setBusy(false); }
  };

  return (
    <AccountShell title="Support">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Questions about an order, a delivery or a product. Replies show here and in your notifications.</p>
        {!creating ? <button className={btnPrimary} onClick={() => setCreating(true)}>New ticket</button> : null}
      </div>
      {creating ? (
        <form onSubmit={create} noValidate className="mb-8 grid max-w-2xl gap-4 rounded-xl border border-line p-5">
          {fe.form ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{fe.form}</p> : null}
          <Field id="t-subject" label="Subject" error={fe.subject}><input id="t-subject" className={inputCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={200} /></Field>
          <Field id="t-order" label="About an order (optional)" hint="Pick the order this is about, if any.">
            <select id="t-order" className={inputCls} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">No specific order</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {STATUS_LABEL[o.status] || o.status}</option>)}
            </select>
          </Field>
          <Field id="t-body" label="Message" error={fe.body}><textarea id="t-body" rows={5} className={inputCls} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={5000} /></Field>
          <div className="flex gap-3"><button className={btnPrimary} disabled={busy}>{busy ? 'Sending…' : 'Send ticket'}</button><button type="button" className={btnGhost} onClick={() => setCreating(false)}>Cancel</button></div>
        </form>
      ) : null}
      {err ? <ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /> : null}
      {!list && !err ? <Skeleton className="h-16" /> : null}
      {list && !list.length && !creating ? <EmptyState title="No tickets yet" body="If something is wrong with an order, start a ticket here." /> : null}
      {list?.length ? (
        <ul className="divide-y divide-line">
          {list.map((t) => (
            <li key={t.id} className="py-3">
              <Link href={`/account/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 hover:underline">
                <span><span className="font-medium">{t.subject}</span><span className="block text-xs text-muted">{t.number} · updated {dateTime(t.updatedAt)}</span></span>
                <StatusPill tone={t.status === 'resolved' || t.status === 'closed' ? 'ok' : 'neutral'}>{TSTATUS[t.status] || t.status}</StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </AccountShell>
  );
}
