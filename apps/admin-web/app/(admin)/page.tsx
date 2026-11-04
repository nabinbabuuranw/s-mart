'use client';
import {useState} from 'react';
import {api,rs,qs} from '@/lib/api';
import {useAsync,Async,PageHeader,Select,Guard,Badge,statusTone} from '@/components/ui';
function Chart({series}:{series:any[]}){
  if(!series?.length)return null;const max=Math.max(1,...series.map(s=>s.revenue));const w=720,h=200,bw=w/series.length;
  return <figure><svg viewBox={`0 0 ${w} ${h+24}`} role="img" aria-label="Revenue per day" className="w-full"><line x1="0" x2={w} y1={h} y2={h} stroke="var(--line)"/>{series.map((s,i)=>{const bh=Math.round((s.revenue/max)*(h-8));return <g key={s.date}><rect x={i*bw+2} y={h-bh} width={Math.max(2,bw-4)} height={bh} fill="var(--accent)" opacity=".85"><title>{`${s.date}: ${rs(s.revenue)} · ${s.orders} orders`}</title></rect></g>})}
  <text x="0" y={h+16} fontSize="10" fill="var(--muted)">{series[0].date}</text><text x={w} y={h+16} fontSize="10" textAnchor="end" fill="var(--muted)">{series[series.length-1].date}</text></svg>
  <figcaption className="sr-only">Daily revenue bar chart</figcaption></figure>}
export default function Dashboard(){
  const [days,setDays]=useState(30);const s=useAsync(()=>api('/admin/analytics/summary'+qs({days})),[days]);
  return <Guard perm="dashboard.view"><PageHeader title="Dashboard" sub="Counts exclude cancelled orders. COD revenue becomes paid on delivery."><Select aria-label="Range" value={days} onChange={(e:any)=>setDays(+e.target.value)} className="!w-auto"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></Select></PageHeader>
  <Async s={s}>{(d:any)=><div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Orders',d.countedOrders],['Revenue',rs(d.revenue)],['Paid revenue',rs(d.paidRevenue)],['Average order',rs(d.averageOrderValue)],['Customers',d.customers],['New customers',d.newCustomers],['Low stock',d.lowStock],['Open tickets',d.openTickets],['Pending returns',d.pendingReturns]].map(([k,v]:any,i)=><div key={k} className="card rise p-4" style={{animationDelay:i*30+'ms'}}><p className="text-xs uppercase tracking-wide text-muted">{k}</p><p className="display mt-1 text-2xl">{v}</p></div>)}</div>
    <div className="grid gap-4 lg:grid-cols-3"><section className="card p-4 lg:col-span-2"><h2 className="mb-3 text-lg">Revenue by day</h2>{d.series?.some((x:any)=>x.revenue>0)?<Chart series={d.series}/>:<p className="py-10 text-center text-sm text-muted">No revenue in this range yet.</p>}</section>
    <section className="card p-4"><h2 className="mb-3 text-lg">Orders by status</h2>{Object.keys(d.byStatus||{}).length?<ul className="space-y-2 text-sm">{Object.entries(d.byStatus).map(([k,v]:any)=><li key={k} className="flex justify-between"><Badge tone={statusTone(k)}>{k.replace(/_/g,' ')}</Badge><span>{v}</span></li>)}</ul>:<p className="py-6 text-sm text-muted">No orders yet.</p>}</section></div>
    <section className="card p-4"><h2 className="mb-3 text-lg">Top products</h2>{d.topProducts?.length?<ol className="divide-y divide-line text-sm">{d.topProducts.map((p:any,i:number)=><li key={i} className="flex justify-between py-2"><span>{p.name||p.productName||p.sku}</span><span className="text-muted">{p.quantity??p.units??p.qty} sold{p.revenue!=null?' · '+rs(p.revenue):''}</span></li>)}</ol>:<p className="py-4 text-sm text-muted">No sales in this range yet.</p>}</section></div>}</Async></Guard>;
}
