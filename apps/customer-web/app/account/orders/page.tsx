'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, dateTime, errorText, money, STATUS_LABEL } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { AccountShell } from '@/components/Account';
import { EmptyState, ErrorState, Pager, Skeleton, StatusPill } from '@/components/ui';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const pageSize = 10;
  useEffect(() => {
    setErr(null);
    api<any>(`/me/orders?page=${page}&pageSize=${pageSize}`, { quiet: true }).then(setData).catch((e) => setErr(errorText(e)));
  }, [page, tick]);
  useRealtime({ private: true }, (type) => { if (type === 'order.updated') setTick((t) => t + 1); });

  return (
    <AccountShell title="Your orders">
      {err ? <ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /> : null}
      {!data && !err ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : null}
      {data && !data.items.length ? <EmptyState title="No orders yet" body="When you place an order it will show here with live tracking." action={{ label: 'Shop now', href: '/products' }} /> : null}
      {data?.items?.length ? (
        <ul className="divide-y divide-line">
          {data.items.map((o: any) => (
            <li key={o.id} className="py-4">
              <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg hover:bg-soft/60">
                <div>
                  <p className="font-medium">Order {o.number}</p>
                  <p className="text-sm text-muted">{dateTime(o.placedAt || o.createdAt)} · {money(o.total)} · {o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod}</p>
                </div>
                <StatusPill tone={o.status === 'delivered' ? 'ok' : o.status === 'cancelled' ? 'bad' : 'neutral'}>{STATUS_LABEL[o.status] || o.status}</StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {data ? <Pager page={page} pageSize={pageSize} total={data.total} onPage={setPage} /> : null}
    </AccountShell>
  );
}
