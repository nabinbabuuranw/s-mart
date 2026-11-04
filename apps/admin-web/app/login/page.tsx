'use client';
import {useState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/lib/auth';
import {Button,Field,Input} from '@/components/ui';
import {Logo} from '@/components/Logo';
import {errText} from '@/lib/api';
export default function Login(){
  const {login,user,ready}=useAuth();const r=useRouter();const [email,setEmail]=useState('');const [pw,setPw]=useState('');const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{if(ready&&user)r.replace('/')},[ready,user]);
  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
    <section className="hidden flex-col justify-between bg-ink p-12 text-paper lg:flex"><div className="flex items-center gap-3"><Logo size={36}/><span className="display text-2xl">S Mart</span></div>
      <div><h1 className="display max-w-md text-5xl leading-[1.05]">One console for every shelf, order and customer.</h1><p className="mt-5 max-w-sm text-sm opacity-70">Staff sign-in only. Every action is permission-checked on the server and written to the audit log.</p></div>
      <p className="text-xs opacity-60">Milestone 1 build. Demo data is labelled DEMO.</p></section>
    <section className="flex items-center justify-center p-6"><form className="w-full max-w-sm" onSubmit={async e=>{e.preventDefault();setBusy(true);setErr('');try{await login(email,pw);r.replace('/')}catch(x:any){setErr(x.code==='account_locked'?'Account locked after repeated failures. Try again in 15 minutes.':x.status===429?'Too many attempts. Wait a moment.':x.status===401?'Email or password is incorrect.':errText(x))}finally{setBusy(false)}}}>
      <div className="mb-8 flex items-center gap-3 lg:hidden"><Logo/><span className="display text-xl">S Mart Admin</span></div>
      <h2 className="mb-1 text-3xl">Sign in</h2><p className="mb-6 text-sm text-muted">Use your staff account.</p>
      <div className="space-y-4"><Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e:any)=>setEmail(e.target.value)}/></Field>
      <Field label="Password"><Input type="password" autoComplete="current-password" required value={pw} onChange={(e:any)=>setPw(e.target.value)}/></Field></div>
      {err&&<p role="alert" className="mt-4 text-sm text-danger">{err}</p>}
      <Button type="submit" loading={busy} className="mt-6 w-full">Sign in</Button></form></section></main>;
}
