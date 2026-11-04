'use client';
import {useState} from 'react';
import {download,errText} from '@/lib/api';
import {PageHeader,Button,Select,Guard,useToast} from '@/components/ui';
const TYPES:[string,string,string][]=[['sales','Sales','Revenue and order totals by day.'],['orders','Orders','Every order in the range with status.'],['inventory','Inventory','Stock levels and low-stock flags.'],['customers','Customers','Customer list with order counts.']];
export default function Reports(){const toast=useToast();const [days,setDays]=useState(30);const [busy,setBusy]=useState('');
  const go=async(t:string,fmt:string)=>{const k=t+fmt;setBusy(k);try{await download(`/admin/reports/${t}?format=${fmt}&days=${days}`,`smart-${t}-${new Date().toISOString().slice(0,10)}.${fmt}`);toast('Downloaded '+t+' ('+fmt.toUpperCase()+')')}catch(e){toast(errText(e),'err')}finally{setBusy('')}};
  return <Guard perm="reports.export"><PageHeader title="Reports" sub="Export as CSV, Excel or PDF."><Select aria-label="Range" className="!w-auto" value={days} onChange={(e:any)=>setDays(+e.target.value)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 365 days</option></Select></PageHeader>
  <div className="grid gap-4 sm:grid-cols-2">{TYPES.map(([t,l,d])=><section key={t} className="card p-5"><h2 className="text-xl">{l}</h2><p className="mb-4 mt-1 text-sm text-muted">{d}</p><div className="flex gap-2">{[['csv','CSV'],['xlsx','Excel'],['pdf','PDF']].map(([f,fl])=><Button key={f} variant="ghost" size="sm" loading={busy===t+f} onClick={()=>go(t,f)}>{fl}</Button>)}</div></section>)}</div></Guard>}
