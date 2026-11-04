'use client';
import Link from 'next/link';
import {api,rs,dt} from '@/lib/api';
import {useAsync,Async,PageHeader,Table,Badge,Empty,Guard,statusTone} from '@/components/ui';
export default function Payments(){const s=useAsync(()=>api('/admin/payments'),[]);
  return <Guard perm="payments.read"><PageHeader title="Payments" sub="Only Cash on Delivery is enabled. A payment is marked paid after delivery."/>
  <Async s={s} isEmpty={(d:any)=>!(d.items||d).length} empty={<Empty title="No payments yet"/>}>{(d:any)=><Table rows={d.items||d} cols={[{h:'Order',r:(p:any)=>p.orderId?<Link className="underline" href={'/orders/'+p.orderId}>{p.order?.number||p.orderId.slice(0,8)}</Link>:'—'},{h:'Method',r:(p:any)=>(p.method||p.provider||'').toUpperCase()},{h:'Amount',r:(p:any)=>rs(p.amount)},{h:'Status',r:(p:any)=><Badge tone={p.status==='paid'?'ok':p.status==='failed'?'danger':'warn'}>{p.status}</Badge>},{h:'Date',r:(p:any)=><span className="text-xs text-muted">{dt(p.paidAt||p.createdAt)}</span>}]}/>}</Async></Guard>}
