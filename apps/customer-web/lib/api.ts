import { formatNpr } from '@smart/shared';

export class ApiError extends Error {
  status: number; code: string; details: any;
  constructor(status: number, code: string, message: string, details?: any) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}

const headers = (method: string) => ({ 'X-Client': 'customer', ...(method !== 'GET' ? { 'X-CSRF': '1' } : {}) });
let refreshing: Promise<boolean> | null = null;
function refresh() {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include', headers: headers('POST') })
      .then((r) => r.ok).catch(() => false)
      .finally(() => { setTimeout(() => { refreshing = null; }, 50); });
  }
  return refreshing;
}

export interface ApiOptions {
  method?: string; body?: any; headers?: Record<string, string>; quiet?: boolean; blob?: boolean;
}

/** Cookie-mode call to the real API through the same-origin proxy. A 401 refreshes once, then retries once. */
export async function api<T = any>(path: string, o: ApiOptions = {}): Promise<T> {
  const method = o.method || 'GET';
  const go = () => fetch('/api/v1' + path, {
    method, credentials: 'include',
    headers: { ...headers(method), ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) },
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
  let r = await go();
  if (r.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    if (await refresh()) r = await go();
    else if (!o.quiet && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
      location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
      throw new ApiError(401, 'unauthenticated', 'Please sign in to continue.');
    }
  }
  if (o.blob) { if (!r.ok) throw new ApiError(r.status, 'download_failed', 'Download failed'); return (await r.blob()) as any; }
  const text = await r.text();
  let j: any = null; try { j = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!r.ok) {
    const e = j?.error || {};
    throw new ApiError(r.status, e.code || 'error', e.message || `Request failed (${r.status})`, e.details);
  }
  return j as T;
}

/** Human words for an error; never a status code. */
export function errorText(e: any): string {
  if (!e) return 'Something went wrong.';
  if (e instanceof ApiError) {
    if (e.status === 0 || e.code === 'network') return 'We could not reach the store. Check your connection and try again.';
    if (e.status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (e.status === 403) return 'This action is not available for your account.';
    if (e.status === 404) return 'We could not find that.';
    if (e.code === 'validation_error' && Array.isArray(e.details) && e.details[0]?.message) return e.details[0].message;
    return e.message || 'Something went wrong.';
  }
  return e.message || 'Something went wrong.';
}

export const money = (minor: number | null | undefined) => formatNpr(Number(minor || 0));
export const dateText = (x: any) => x ? new Date(x).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
export const dateTime = (x: any) => x ? new Date(x).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function qs(o: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined && v !== false) p.set(k, String(v)); });
  const s = p.toString();
  return s ? '?' + s : '';
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment', placed: 'Placed', confirmed: 'Confirmed', packed: 'Packed',
  shipped: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled',
  return_requested: 'Return requested', returned: 'Returned', refunded: 'Refunded',
};
