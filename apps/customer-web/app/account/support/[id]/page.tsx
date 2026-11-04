'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, dateTime, errorText } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { AccountShell } from '@/components/Account';
import { ErrorState, Skeleton, btnPrimary, inputCls } from '@/components/ui';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [body, setBody] = useState('');
  const [sendErr, setSendErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setErr(null); api<any>(`/me/tickets/${id}`, { quiet: true }).then(setT).catch((e) => setErr(e?.status === 404 ? 'We could not find this ticket.' : errorText(e))); }, [id, tick]);
  useRealtime({ private: true }, (type, d) => { if (type === 'ticket.reply' && (!d?.ticketId || d.ticketId === id)) setTick((x) => x + 1); });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) { setSendErr('Write a message first.'); return; }
    setBusy(true); setSendErr('');
    try { await api(`/me/tickets/${id}/messages`, { method: 'POST', body: { body: body.trim() } }); setBody(''); setTick((x) => x + 1); }
    catch (ex) { setSendErr(errorText(ex)); }
    finally { setBusy(false); }
  };

  if (err) return <AccountShell title="Ticket"><ErrorState message={err} onRetry={() => setTick((x) => x + 1)} /><Link href="/account/support" className="mt-4 inline-block text-sm underline">Back to support</Link></AccountShell>;
  if (!t) return <AccountShell title="Ticket"><Skeleton className="h-40" /></AccountShell>;
  const msgs = (t.messages || []).filter((m: any) => !m.internal);
  const closed = t.status === 'closed';
  return (
    <AccountShell title={t.subject}>
      <p className="mb-6 text-sm text-muted">{t.number} · {t.status}</p>
      <ol className="space-y-3" aria-label="Messages">
        {msgs.map((m: any) => {
          const mine = m.authorType === 'customer' || m.fromCustomer || m.authorId === t.userId;
          return (
            <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? 'ml-auto bg-primary text-on-primary' : 'bg-soft text-ink'}`}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              <p className={`mt-1 text-xs ${mine ? 'opacity-80' : 'text-muted'}`}>{mine ? 'You' : 'S Mart support'} · {dateTime(m.createdAt)}</p>
            </li>
          );
        })}
      </ol>
      {closed ? <p className="mt-6 text-sm text-muted">This ticket is closed. Start a new one if you still need help.</p> : (
        <form onSubmit={send} className="mt-6 space-y-3" noValidate>
          <label htmlFor="reply" className="block text-sm font-medium">Reply</label>
          <textarea id="reply" rows={3} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
          {sendErr ? <p role="alert" className="text-sm text-danger">{sendErr}</p> : null}
          <button className={btnPrimary} disabled={busy}>{busy ? 'Sending…' : 'Send reply'}</button>
        </form>
      )}
    </AccountShell>
  );
}
