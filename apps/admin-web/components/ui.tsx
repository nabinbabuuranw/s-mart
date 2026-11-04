'use client';
import React,{useEffect,useRef,useState,createContext,useContext,useCallback} from 'react';
import { errText } from '@/lib/api';
import { useAuth } from '@/lib/auth';
export const cx=(...a:any[])=>a.filter(Boolean).join(' ');
export const Spinner=()=><span aria-hidden className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"/>;
export function Button({variant='primary',size,loading,className,children,...p}:any){
  const v:any={primary:'bg-accent text-on-accent hover:bg-accent-hover',ghost:'border border-line hover:bg-hover',danger:'bg-danger text-paper hover:opacity-90',quiet:'hover:bg-hover'};
  return <button type="button" {...p} disabled={p.disabled||loading} className={cx('inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',size==='sm'&&'!px-2.5 !py-1 text-xs',v[variant],className)}>{loading&&<Spinner/>}{children}</button>;
}
export function Field({label,error,hint,children,className}:any){const id=React.useId();return <div className={className}><label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}</label>{React.cloneElement(children,{id,'aria-invalid':!!error||undefined})}{hint&&<p className="mt-1 text-xs text-muted">{hint}</p>}{error&&<p role="alert" className="mt-1 text-xs text-danger">{error}</p>}</div>}
export const Input=(p:any)=><input {...p} className={cx('inp',p.className)}/>;
export const Select=(p:any)=><select {...p} className={cx('inp',p.className)}/>;
export const Area=(p:any)=><textarea rows={3} {...p} className={cx('inp',p.className)}/>;
export const Check=({label,...p}:any)=><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...p} className="h-4 w-4 accent-[var(--accent)]"/>{label}</label>;
const TONES:any={ok:'text-ok border-ok/40',warn:'text-warn border-warn/40',danger:'text-danger border-danger/40',muted:'text-muted border-line',accent:'text-accent border-accent/40'};
export const Badge=({tone='muted',children}:any)=><span className={cx('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',TONES[tone])}>{children}</span>;
export const statusTone=(s:string)=>({delivered:'ok',refunded:'ok',returned:'warn',cancelled:'danger',return_requested:'warn',pending_payment:'warn',open:'warn',pending:'warn',resolved:'ok',closed:'muted',approved:'ok',rejected:'danger',received:'ok',requested:'warn'} as any)[s]||'accent';
export const Skeleton=({rows=5}:any)=><div aria-busy="true" aria-label="Loading" className="space-y-2">{Array.from({length:rows}).map((_,i)=><div key={i} className="skel h-10 w-full"/>)}</div>;
export const Empty=({title,hint}:any)=><div className="card px-6 py-12 text-center"><p className="display text-lg">{title}</p>{hint&&<p className="mt-1 text-sm text-muted">{hint}</p>}</div>;
export const ErrorBox=({error,retry}:any)=><div role="alert" className="card border-danger/50 p-5"><p className="font-medium text-danger">{error?.status===403?'No access':'Could not load this'}</p><p className="mt-1 text-sm text-muted">{error?.local?error.message:errText(error)}</p>{retry&&error?.status!==403&&<Button variant="ghost" size="sm" className="mt-3" onClick={retry}>Try again</Button>}</div>;
export function useAsync<T>(fn:()=>Promise<T>,deps:any[]){
  const [st,set]=useState<{data:T|null;loading:boolean;error:any}>({data:null,loading:true,error:null});const [n,setN]=useState(0);
  useEffect(()=>{let live=true;set(s=>({...s,loading:true,error:null}));fn().then(d=>live&&set({data:d,loading:false,error:null})).catch(e=>live&&set({data:null,loading:false,error:e}));return()=>{live=false}},[...deps,n]);
  useEffect(()=>{const h=()=>setN(x=>x+1);window.addEventListener('sm-live',h);return()=>window.removeEventListener('sm-live',h)},[]);
  return {...st,reload:()=>setN(x=>x+1)};
}
export function Async({s,children,empty,isEmpty}:any){ if(s.error) return <ErrorBox error={s.error} retry={s.reload}/>; if(!s.data&&s.loading) return <Skeleton/>; if(isEmpty&&isEmpty(s.data)) return empty; return <>{children(s.data)}</>; }
export function Modal({title,onClose,children,wide}:any){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',k);const el=ref.current?.querySelector<HTMLElement>('input,select,textarea,button');el?.focus();return()=>document.removeEventListener('keydown',k)},[]);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx('rise card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-b-[10px]',wide?'sm:max-w-3xl':'sm:max-w-lg')}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded p-1 text-muted hover:bg-hover">✕</button></div>{children}</div></div>;
}
export function Confirm({title,text,onYes,onClose,label='Confirm',danger}:any){const [b,setB]=useState(false);return <Modal title={title} onClose={onClose}><p className="text-sm text-muted">{text}</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger?'danger':'primary'} loading={b} onClick={async()=>{setB(true);try{await onYes()}finally{setB(false)}}}>{label}</Button></div></Modal>}
export function Pager({page,pageSize,total,onPage}:any){const pages=Math.max(1,Math.ceil(total/pageSize));return <div className="mt-3 flex items-center justify-between text-sm text-muted"><span>{total} total</span><div className="flex items-center gap-2"><Button size="sm" variant="ghost" disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</Button><span>Page {page} of {pages}</span><Button size="sm" variant="ghost" disabled={page>=pages} onClick={()=>onPage(page+1)}>Next</Button></div></div>}
export function Table({cols,rows,onRow,rowKey='id'}:any){return <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{cols.map((c:any,i:number)=><th key={i} scope="col" className={cx('px-4 py-3 font-medium',c.cls)}>{c.h}</th>)}</tr></thead><tbody>{rows.map((r:any,ri:number)=><tr key={r[rowKey]||ri} className={cx('border-b border-line/60 last:border-0',onRow&&'cursor-pointer hover:bg-hover')} onClick={onRow?()=>onRow(r):undefined}>{cols.map((c:any,i:number)=><td key={i} className={cx('px-4 py-3 align-middle',c.cls)}>{c.r(r)}</td>)}</tr>)}</tbody></table></div>}
export function PageHeader({title,sub,children}:any){return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl">{title}</h1>{sub&&<p className="mt-1 text-sm text-muted">{sub}</p>}</div><div className="flex flex-wrap items-center gap-2">{children}</div></div>}
const TC=createContext<any>(null);
export function ToastProvider({children}:any){const [t,set]=useState<any[]>([]);const push=useCallback((msg:string,kind='ok')=>{const id=Math.random();set(a=>[...a,{id,msg,kind}]);setTimeout(()=>set(a=>a.filter(x=>x.id!==id)),5000)},[]);
  return <TC.Provider value={push}>{children}<div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">{t.map(x=><div key={x.id} className={cx('rise card border-l-4 px-4 py-3 text-sm shadow-lg',x.kind==='err'?'border-l-danger':x.kind==='info'?'border-l-accent':'border-l-ok')}>{x.msg}</div>)}</div></TC.Provider>}
export const useToast=()=>useContext(TC);
export function Guard({perm,children}:any){const {can}=useAuth();if(!can(perm))return <ErrorBox error={{status:403,local:true,message:'Your role does not include this area.'}}/>;return <>{children}</>}
export function useForm<T extends Record<string,any>>(init:T){const [v,setV]=useState<T>(init);const [err,setErr]=useState<Record<string,string>>({});const [msg,setMsg]=useState('');
  const set=(k:string,x:any)=>setV(o=>({...o,[k]:x}));const bind=(k:string)=>({value:v[k]??'',onChange:(e:any)=>set(k,e.target.value)});
  const fail=(e:any)=>{const m:Record<string,string>={};(e?.details||[]).forEach((d:any)=>{m[String(d.path||'').split('.')[0]]=d.message});setErr(m);setMsg(errText(e))};
  return {v,set,setV,bind,err,msg,fail,clear:()=>{setErr({});setMsg('')}}}
