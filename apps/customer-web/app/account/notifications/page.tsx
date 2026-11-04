'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, dateTime, errorText } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { useToast } from '@/components/Toast';
import { AccountShell } from '@/components/Account';
import { EmptyState, ErrorState, Pager, Skeleton, btnGhost } from '@/components/ui';

export default function NotificationsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { setErr(null); api<any>(`/me/notifications?page=${page}&pageSize=10`, { quiet: true }).then(setData).catch((e) => setErr(errorText(e))); }, [page, tick]);
  useRealtime({ private: true }, (type) => { if (type === 'order.updated' || type === 'ticket.reply') setTick((t) => t + 1); });

  const markOne = async (n: any) => {
    if (n.readAt) return;
    try { await api(`/me/notifications/${n.id}/read`, { method: 'POST' }); setTick((t) => t + 1); } catch (e) { toast.show(errorText(e), 'error'); }
  };
  const markAll = async () => {
    try { await api('/me/notifications/read-all', { method: 'POST' }); setTick((t) => t + 1); toast.show('All marked as read', 'ok'); } catch (e) { toast.show(errorText(e), 'error'); }
  };
  const linkFor = (n: any) => (n.data?.orderId ? `/account/orders/${n.data.orderId}` : n.data?.ticketId ? `/account/support/${n.data.ticketId}` : null);

  return (
    <AccountShell title="Notifications">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{data ? `${data.unread} unread` : ' '}</p>
        {data?.unread ? <button className={btnGhost} onClick={markAll}>Mark all as read</button> : null}
      </div>
      {err ? <ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /> : null}
      {!data && !err ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : null}
      {data && !data.items.length ? <EmptyState title="You're all caught up" body="Order updates and support replies will show here." /> : null}
      {data?.items?.length ? (
        <ul className="divide-y divide-line">
          {data.items.map((n: any) => {
            const href = linkFor(n);
            return (
              <li key={n.id} className={`py-4 ${n.readAt ? '' : 'pl-3 border-l-2 border-accent'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm ${n.readAt ? 'text-muted' : 'font-medium'}`}>{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-sm text-muted">{n.body}</p> : null}
                    <p className="mt-1 text-xs text-muted">{dateTime(n.createdAt)}</p>
                  </div>
                  <div className="flex gap-3 text-sm">
                    {href ? <Link href={href} onClick={() => markOne(n)} className="font-medium underline underline-offset-4">Open</Link> : null}
                    {!n.readAt ? <button onClick={() => markOne(n)} className="text-muted underline underline-offset-4 hover:text-ink">Mark read</button> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {data ? <Pager page={page} pageSize={10} total={data.total} onPage={setPage} /> : null}
    </AccountShell>
  );
}
