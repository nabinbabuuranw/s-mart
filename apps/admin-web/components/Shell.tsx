'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {api,rs,dt} from '@/lib/api';
import {useToast,Button,cx} from '@/components/ui';
import {Logo} from '@/components/Logo';
const NAV:[string,string,string|string[]][]=[
 ['/','Dashboard','dashboard.view'],['/orders','Orders','orders.read'],['/returns','Returns & refunds','returns.manage'],['/payments','Payments','payments.read'],
 ['/products','Products','products.read'],['/categories','Categories','products.read'],['/inventory','Inventory','inventory.read'],['/offers','Offers & coupons','pricing.write'],['/banners','Banners','banners.write'],
 ['/customers','Customers','customers.read'],['/tickets','Support tickets','tickets.read'],['/users','Staff & roles',['users.manage','roles.manage']],
 ['/reports','Reports','reports.export'],['/audit','Audit log','audit.read'],['/backups','Backups','backup.manage'],['/settings','Settings','settings.write']];
export function Shell({children}:any){
  const {user,ready,can,logout}=useAuth();const path=usePathname();const router=useRouter();const toast=useToast();
  const [open,setOpen]=useState(false);const [dark,setDark]=useState(false);const [bell,setBell]=useState<any>(null);const [bellOpen,setBellOpen]=useState(false);const [sound,setSound]=useState(false);const [live,setLive]=useState(false);
  useEffect(()=>{if(ready&&!user)router.replace('/login')},[ready,user]);
  useEffect(()=>{setDark(document.documentElement.classList.contains('dark'));setSound(localStorage.getItem('sm-sound')==='on')},[]);
  useEffect(()=>{setOpen(false)},[path]);
  const soundRef=useRef(false);soundRef.current=sound;
  const loadBell=()=>api('/admin/notifications').then(setBell).catch(()=>{});
  useEffect(()=>{
    if(!user)return;loadBell();let es:EventSource|null=null;let dead=false;let timer:any;
    const beep=()=>{try{const c=new AudioContext();const o=c.createOscillator();o.connect(c.destination);o.frequency.value=660;o.start();o.stop(c.currentTime+.15)}catch{}};
    const onEv=(type:string,raw:string)=>{let d:any={};try{d=JSON.parse(raw)}catch{};const t=d.type||type;const data=d.data||d;
      if(type==='ping'||type==='message'&&!d.type)return;
      window.dispatchEvent(new Event('sm-live'));
      if(t==='order.created'){toast(`New order ${data.number||''}${data.total?' · '+rs(data.total):''}`,'info');if(soundRef.current)beep();loadBell()}
      else if(t==='return.requested'){toast('New return request','info');loadBell()}
      else if(t==='ticket.created'){toast('New support ticket','info');loadBell()}
      else if(t==='ticket.reply'){loadBell()}};
    const connect=async()=>{try{const {ticket}=await api('/realtime/ticket',{method:'POST'});if(dead)return;es=new EventSource('/api/v1/realtime/stream?ticket='+ticket);
      es.onopen=()=>setLive(true);es.onerror=()=>{setLive(false);es?.close();if(!dead)timer=setTimeout(connect,4000)};
      ['order.created','order.updated','return.requested','ticket.created','ticket.reply','product.updated','inventory.changed'].forEach(n=>es!.addEventListener(n,(e:any)=>onEv(n,e.data)));
      es.onmessage=(e:any)=>onEv('message',e.data)}catch{timer=setTimeout(connect,8000)}};
    connect();return()=>{dead=true;es?.close();clearTimeout(timer)}},[user?.id]);
  if(!ready||!user)return <div className="grid min-h-screen place-items-center"><span className="skel h-8 w-40"/></div>;
  const items=NAV.filter(([,,p])=>can(p));
  const nav=<nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">{items.map(([h,l])=>{const a=h==='/'?path==='/':path.startsWith(h);return <Link key={h} href={h} aria-current={a?'page':undefined} className={cx('block rounded-md px-3 py-2 text-sm transition',a?'bg-ink text-paper':'text-muted hover:bg-hover hover:text-ink')}>{l}</Link>})}</nav>;
  return <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface lg:flex"><div className="flex items-center gap-2.5 px-5 py-5"><Logo/><span className="display text-xl">S Mart</span><span className="ml-auto text-[10px] uppercase tracking-widest text-muted">Admin</span></div>{nav}</aside>
    {open&&<div className="fixed inset-0 z-40 lg:hidden" onClick={()=>setOpen(false)}><div className="absolute inset-0 bg-black/50"/><aside className="rise absolute left-0 top-0 flex h-full w-64 flex-col bg-surface" onClick={e=>e.stopPropagation()}><div className="flex items-center gap-2.5 px-5 py-5"><Logo/><span className="display text-xl">S Mart</span></div>{nav}</aside></div>}
    <div className="min-w-0"><header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur-none">
      <button className="rounded-md p-2 hover:bg-hover lg:hidden" aria-label="Open menu" onClick={()=>setOpen(true)}>☰</button>
      <span className="text-xs text-muted" title={live?'Live updates connected':'Reconnecting'}><span className={cx('mr-1.5 inline-block h-2 w-2 rounded-full',live?'bg-ok':'bg-warn')}/> {live?'Live':'Offline'}</span>
      <div className="ml-auto flex items-center gap-1">
        <label className="mr-2 hidden items-center gap-1.5 text-xs text-muted sm:flex"><input type="checkbox" className="accent-[var(--accent)]" checked={sound} onChange={e=>{setSound(e.target.checked);localStorage.setItem('sm-sound',e.target.checked?'on':'off')}}/>Order sound</label>
        <button className="rounded-md px-2.5 py-1.5 text-sm hover:bg-hover" aria-label="Toggle dark mode" onClick={()=>{const d=!dark;setDark(d);document.documentElement.classList.toggle('dark',d);localStorage.setItem('sm-theme',d?'dark':'light')}}>{dark?'Light':'Dark'}</button>
        <div className="relative"><button className="relative rounded-md px-2.5 py-1.5 text-sm hover:bg-hover" aria-label={`Notifications, ${bell?.unread||0} unread`} onClick={()=>{setBellOpen(!bellOpen);loadBell()}}>Alerts{bell?.unread>0&&<span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs text-on-accent">{bell.unread}</span>}</button>
          {bellOpen&&<div className="rise card absolute right-0 mt-2 w-80 max-w-[90vw] p-2 shadow-lg"><div className="flex items-center justify-between px-2 py-1 text-xs text-muted"><span>Notifications</span><button className="underline" onClick={async()=>{await api('/admin/notifications/read-all',{method:'POST'});loadBell()}}>Mark all read</button></div>
            {(bell?.items||[]).length===0?<p className="px-3 py-6 text-center text-sm text-muted">Nothing new.</p>:<ul className="max-h-80 overflow-y-auto">{bell.items.slice(0,12).map((n:any)=><li key={n.id} className={cx('rounded px-3 py-2 text-sm',!n.readAt&&'bg-hover')}><p className="font-medium">{n.title||n.type}</p><p className="text-xs text-muted">{n.body||n.message}</p><p className="text-[11px] text-muted">{dt(n.createdAt)}</p></li>)}</ul>}</div>}</div>
        <div className="ml-2 hidden text-right leading-tight sm:block"><p className="text-sm">{user.name}</p><p className="text-[11px] text-muted">{user.role}</p></div>
        <Button variant="ghost" size="sm" onClick={logout} className="ml-2">Sign out</Button></div></header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main></div></div>;
}
