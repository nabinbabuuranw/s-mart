'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { errorText, ApiError } from '@/lib/api';
import { Field, btnPrimary, inputCls, cardCls } from '@/components/ui';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ form?: string; email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) err.email = 'Enter the email you registered with.';
    if (!password) err.password = 'Enter your password.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace(next.startsWith('/') ? next : '/account');
    } catch (ex: any) {
      const msg = ex instanceof ApiError && ex.status === 401 ? 'That email and password do not match. Check and try again.'
        : ex instanceof ApiError && ex.status === 403 ? 'This account is locked after too many failed tries. Wait 15 minutes, then try again.'
        : errorText(ex);
      setErrors({ form: msg });
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <div className={`${cardCls} p-6 md:p-8`}>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">New to S Mart? <Link href={'/register' + (next !== '/account' ? '?next=' + encodeURIComponent(next) : '')} className="font-medium text-accent-text underline underline-offset-2">Create an account</Link></p>
        <form method="post" onSubmit={submit} noValidate className="mt-6 space-y-5" aria-describedby={errors.form ? 'form-error' : undefined}>
          {errors.form ? <p id="form-error" role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{errors.form}</p> : null}
          <Field id="email" label="Email" error={errors.email}>
            <input id="email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
          </Field>
          <Field id="password" label="Password" error={errors.password}>
            <input id="password" type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} />
          </Field>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="p-10 text-center text-muted">Loading…</div>}><LoginForm /></Suspense>;
}
