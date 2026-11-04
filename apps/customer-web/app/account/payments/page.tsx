'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, dateTime, errorText, money } from '@/lib/api';
import { AccountShell } from '@/components/Account';
import { EmptyState, ErrorState, Skeleton, StatusPill } from '@/components/ui';

export default function PaymentsPage() {
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { setErr(null); api<any>('/me/payments', { quiet: true }).then((j) => setList(Array.isArray(j) ? j : j?.items || [])).catch((e) => setErr(errorText(e))); }, [tick]);
  return (
    <AccountShell title="Payment history">
      <p className="mb-5 text-sm text-muted">Your payments are cash on delivery. A payment shows here once the driver has collected it.</p>
      {err ? <ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /> : null}
      {!list && !err ? <Skeleton className="h-16" /> : null}
      {list && !list.length ? <EmptyState title="No payments yet" body="Payments appear here after an order is delivered." /> : null}
      {list?.length ? (
        <ul className="divide-y divide-line">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{money(p.amount)} · {p.provider === 'cod' ? 'Cash on delivery' : p.provider}</p>
                <p className="text-muted">{dateTime(p.verifiedAt || p.createdAt)}{p.orderId ? <> · <Link className="underline" href={`/account/orders/${p.orderId}`}>View order</Link></> : null}</p>
              </div>
              <StatusPill tone={p.status === 'paid' || p.status === 'verified' || p.status === 'captured' ? 'ok' : 'neutral'}>{p.status}</StatusPill>
            </li>
          ))}
        </ul>
      ) : null}
    </AccountShell>
  );
}
