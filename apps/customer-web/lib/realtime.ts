'use client';
import { useEffect, useRef } from 'react';

/** Subscribe to the live stream. Private streams first take a one-time ticket (cookie auth). Reconnects with a new ticket. */
export function useRealtime(opts: { private?: boolean; enabled?: boolean }, onEvent: (type: string, data: any) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const priv = !!opts.private;
  const enabled = opts.enabled !== false;
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let es: EventSource | null = null;
    let closed = false;
    let timer: any = null;
    const types = ['order.created', 'order.updated', 'return.requested', 'ticket.created', 'ticket.reply',
      'product.created', 'product.updated', 'product.deleted', 'category.changed', 'inventory.changed',
      'offer.changed', 'banner.changed', 'settings.changed', 'notification.created'];
    const connect = async (attempt: number) => {
      if (closed) return;
      let url = '/api/v1/realtime/stream';
      try {
        if (priv) {
          const r = await fetch('/api/v1/realtime/ticket', { method: 'POST', credentials: 'include', headers: { 'X-Client': 'customer', 'X-CSRF': '1' } });
          if (!r.ok) throw new Error('ticket');
          const j = await r.json();
          url += '?ticket=' + encodeURIComponent(j.ticket);
        }
      } catch {
        if (!closed) timer = setTimeout(() => connect(attempt + 1), Math.min(30000, 2000 * (attempt + 1)));
        return;
      }
      es = new EventSource(url, { withCredentials: true });
      es.onopen = () => { attempt = 0; };
      types.forEach((t) => es!.addEventListener(t, (e: any) => {
        let d: any = {}; try { d = JSON.parse(e.data); } catch { /* ignore */ }
        handler.current(t, d);
      }));
      es.onerror = () => {
        es?.close(); es = null;
        if (!closed) timer = setTimeout(() => connect(attempt + 1), Math.min(30000, 2000 * (attempt + 1)));
      };
    };
    connect(0);
    return () => { closed = true; clearTimeout(timer); es?.close(); };
  }, [priv, enabled]);
}
