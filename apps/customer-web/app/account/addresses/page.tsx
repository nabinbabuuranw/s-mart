'use client';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { AccountShell } from '@/components/Account';
import { EmptyState, ErrorState, Field, Skeleton, btnDanger, btnGhost, btnPrimary, cardCls, inputCls } from '@/components/ui';

const BLANK = { label: 'Home', fullName: '', phone: '', line1: '', line2: '', city: '', district: '', province: '', postalCode: '' };

export default function AddressesPage() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null); // null = closed; {} = new
  const [f, setF] = useState<any>(BLANK);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { setErr(null); api<any[]>('/me/addresses', { quiet: true }).then(setList).catch((e) => setErr(errorText(e))); }, [tick]);

  const open = (a?: any) => { setEditing(a || {}); setFe({}); setF(a ? { ...BLANK, ...a, line2: a.line2 || '', district: a.district || '', province: a.province || '', postalCode: a.postalCode || '' } : { ...BLANK }); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!f.fullName.trim()) x.fullName = 'Enter the name for delivery.';
    if (!/^[0-9+ ()-]{7,20}$/.test(f.phone.trim())) x.phone = 'Enter a phone number we can call.';
    if (!f.line1.trim()) x.line1 = 'Enter the street or area.';
    if (!f.city.trim()) x.city = 'Enter the city or town.';
    setFe(x); if (Object.keys(x).length) return;
    const body: any = { label: f.label.trim() || 'Home', fullName: f.fullName.trim(), phone: f.phone.trim(), line1: f.line1.trim(), city: f.city.trim() };
    ['line2', 'district', 'province', 'postalCode'].forEach((k) => { const v = (f as any)[k]?.trim(); body[k] = v || null; });
    setBusy(true);
    try {
      if (editing?.id) await api(`/me/addresses/${editing.id}`, { method: 'PUT', body });
      else await api('/me/addresses', { method: 'POST', body: { ...body, isDefault: !(list || []).length } });
      setEditing(null); setTick((t) => t + 1); toast.show('Address saved', 'ok');
    } catch (ex) { setFe({ form: errorText(ex) }); }
    finally { setBusy(false); }
  };
  const makeDefault = async (a: any) => {
    try { await api(`/me/addresses/${a.id}`, { method: 'PUT', body: { isDefault: true } }); setTick((t) => t + 1); toast.show('Default address changed', 'ok'); }
    catch (ex) { toast.show(errorText(ex), 'error'); }
  };
  const remove = async (a: any) => {
    if (!confirm(`Delete the address “${a.label}”? Past orders keep their own copy.`)) return;
    try { await api(`/me/addresses/${a.id}`, { method: 'DELETE' }); setTick((t) => t + 1); toast.show('Address deleted', 'ok'); }
    catch (ex) { toast.show(errorText(ex), 'error'); }
  };

  return (
    <AccountShell title="Addresses">
      {err ? <ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /> : null}
      {!list && !err ? <Skeleton className="h-24" /> : null}
      {list && !list.length && editing === null ? <EmptyState title="No addresses yet" body="Add one so checkout is quicker." /> : null}
      {list?.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className={`${cardCls} p-4 text-sm`}>
              <div className="flex items-center justify-between gap-2"><p className="font-medium">{a.label}{a.isDefault ? <span className="ml-2 rounded-full bg-soft px-2 py-0.5 text-xs">Default</span> : null}</p></div>
              <p className="mt-2 text-muted">{a.fullName}<br />{[a.line1, a.line2, a.city, a.district, a.province, a.postalCode].filter(Boolean).join(', ')}<br />{a.phone}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btnGhost} onClick={() => open(a)}>Edit</button>
                {!a.isDefault ? <button className={btnGhost} onClick={() => makeDefault(a)}>Make default</button> : null}
                <button className={btnDanger} onClick={() => remove(a)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editing === null ? (
        <button className={`${btnPrimary} mt-6`} onClick={() => open()}>Add address</button>
      ) : (
        <form onSubmit={save} noValidate className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 text-lg font-semibold">{editing.id ? 'Edit address' : 'New address'}</h2>
          {fe.form ? <p role="alert" className="sm:col-span-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{fe.form}</p> : null}
          <Field id="a-full" label="Full name" error={fe.fullName}><input id="a-full" className={inputCls} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field id="a-phone" label="Phone" error={fe.phone}><input id="a-phone" type="tel" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field id="a-line1" label="Street or area" error={fe.line1}><input id="a-line1" className={inputCls} value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} /></Field></div>
          <Field id="a-line2" label="Landmark (optional)"><input id="a-line2" className={inputCls} value={f.line2} onChange={(e) => setF({ ...f, line2: e.target.value })} /></Field>
          <Field id="a-city" label="City or town" error={fe.city}><input id="a-city" className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field id="a-district" label="District (optional)"><input id="a-district" className={inputCls} value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} /></Field>
          <Field id="a-label" label="Label"><input id="a-label" className={inputCls} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <div className="flex items-end gap-2 sm:col-span-2"><button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button><button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      )}
    </AccountShell>
  );
}
