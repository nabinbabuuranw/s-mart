'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Field, btnPrimary, inputCls, cardCls } from '@/components/ui';

function RegisterForm() {
  const { refresh } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next') || '/account';
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = 'Tell us your name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) err.email = 'Enter a valid email address.';
    if (f.password.length < 10) err.password = 'Use at least 10 characters.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', quiet: true, body: { name: f.name.trim(), email: f.email.trim(), password: f.password, ...(f.phone.trim() ? { phone: f.phone.trim() } : {}) } });
      await api('/auth/login', { method: 'POST', quiet: true, body: { email: f.email.trim(), password: f.password, audience: 'customer' } });
      await refresh();
      router.replace(next.startsWith('/') ? next : '/account');
    } catch (ex: any) {
      setErrors({ form: ex?.status === 409 ? 'An account with this email already exists. Sign in instead.' : errorText(ex) });
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <div className={`${cardCls} p-6 md:p-8`}>
        <h1 className="text-3xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted">Already registered? <Link href="/login" className="font-medium text-accent-text underline underline-offset-2">Sign in</Link></p>
        <form method="post" onSubmit={submit} noValidate className="mt-6 space-y-5">
          {errors.form ? <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{errors.form}</p> : null}
          <Field id="name" label="Full name" error={errors.name}><input id="name" autoComplete="name" className={inputCls} value={f.name} onChange={set('name')} /></Field>
          <Field id="email" label="Email" error={errors.email}><input id="email" type="email" autoComplete="email" className={inputCls} value={f.email} onChange={set('email')} /></Field>
          <Field id="phone" label="Phone (optional)" hint="Used for delivery calls only."><input id="phone" type="tel" autoComplete="tel" className={inputCls} value={f.phone} onChange={set('phone')} /></Field>
          <Field id="password" label="Password" error={errors.password} hint="At least 10 characters."><input id="password" type="password" autoComplete="new-password" className={inputCls} value={f.password} onChange={set('password')} /></Field>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<div className="p-10 text-center text-muted">Loading…</div>}><RegisterForm /></Suspense>;
}
