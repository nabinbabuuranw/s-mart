'use client';
import { useState } from 'react';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { AccountShell } from '@/components/Account';
import { Field, btnPrimary, inputCls } from '@/components/ui';

export default function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);

  if (user && !loaded) {
    api<any>('/me/profile', { quiet: true }).then((p) => { setName(p.name || ''); setPhone(p.phone || ''); setLoaded(true); }).catch(() => setLoaded(true));
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!name.trim()) x.name = 'Enter your name.';
    if (phone.trim() && !/^[0-9+ ()-]{7,20}$/.test(phone.trim())) x.phone = 'Enter a phone number we can call.';
    setErr(x); if (Object.keys(x).length) return;
    setBusy(true);
    try {
      await api('/me/profile', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() || null } });
      await refresh(); toast.show('Profile saved', 'ok');
    } catch (ex) { setErr({ form: errorText(ex) }); }
    finally { setBusy(false); }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!pw.currentPassword) x.currentPassword = 'Enter your current password.';
    if (pw.newPassword.length < 10) x.newPassword = 'Use at least 10 characters.';
    if (pw.newPassword !== pw.confirm) x.confirm = 'The two passwords do not match.';
    setPwErr(x); if (Object.keys(x).length) return;
    setPwBusy(true);
    try {
      await api('/auth/password', { method: 'PATCH', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.show('Password changed', 'ok');
    } catch (ex: any) {
      setPwErr({ form: ex?.status === 401 || ex?.status === 400 ? 'Your current password is not right.' : errorText(ex) });
    } finally { setPwBusy(false); }
  };

  return (
    <AccountShell title="Your profile">
      <form onSubmit={save} noValidate className="grid max-w-xl gap-5">
        {err.form ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{err.form}</p> : null}
        <Field id="pname" label="Name" error={err.name}><input id="pname" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field id="pemail" label="Email" hint="Your sign-in email. It can't be changed here."><input id="pemail" className={inputCls} value={user?.email || ''} disabled readOnly /></Field>
        <Field id="pphone" label="Phone" error={err.phone}><input id="pphone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <div><button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
      </form>

      <hr className="my-8 border-line" />
      <h2 className="mb-4 text-lg font-semibold">Change password</h2>
      <form onSubmit={changePw} noValidate className="grid max-w-xl gap-5">
        {pwErr.form ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{pwErr.form}</p> : null}
        <Field id="cur" label="Current password" error={pwErr.currentPassword}><input id="cur" type="password" autoComplete="current-password" className={inputCls} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
        <Field id="new" label="New password" error={pwErr.newPassword} hint="At least 10 characters."><input id="new" type="password" autoComplete="new-password" className={inputCls} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
        <Field id="conf" label="Repeat new password" error={pwErr.confirm}><input id="conf" type="password" autoComplete="new-password" className={inputCls} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
        <div><button className={btnPrimary} disabled={pwBusy}>{pwBusy ? 'Changing…' : 'Change password'}</button></div>
      </form>

      <hr className="my-8 border-line" />
      <button onClick={async () => { await logout(); window.location.href = '/'; }} className="text-sm font-medium text-danger underline underline-offset-4">Sign out</button>
    </AccountShell>
  );
}
