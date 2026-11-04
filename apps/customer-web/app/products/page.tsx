'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { api, qs } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { ProductCard } from '@/components/ProductCard';
import { DemoBanner, EmptyState, ErrorState, GridSkeleton, Pager, btnGhost, inputCls } from '@/components/ui';

const SORTS = [
  { value: 'newest', label: 'Newest' }, { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' }, { value: 'name', label: 'Name' },
];

function CatalogInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = sp.get('q') || '';
  const category = sp.get('category') || '';
  const sort = sp.get('sort') || 'newest';
  const onOffer = sp.get('onOffer') === 'true';
  const featured = sp.get('featured') === 'true';
  const minRs = sp.get('minRs') || '';
  const maxRs = sp.get('maxRs') || '';
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = 12;

  const [cats, setCats] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState(q);
  const [min, setMin] = useState(minRs);
  const [max, setMax] = useState(maxRs);

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => { api<any[]>('/catalog/categories', { quiet: true }).then(setCats).catch(() => setCats([])); }, []);
  useEffect(() => {
    setErr(false);
    const toMinor = (v: string) => (v && Number(v) >= 0 ? Math.round(Number(v) * 100) : '');
    const query = qs({ q, category, sort, onOffer: onOffer || '', featured: featured || '', minPrice: toMinor(minRs), maxPrice: toMinor(maxRs), page, pageSize });
    api<any>('/catalog/products' + query, { quiet: true }).then(setData).catch(() => setErr(true));
  }, [q, category, sort, onOffer, featured, minRs, maxRs, page, tick]);
  useRealtime({}, (type) => { if (type.startsWith('product.') || type === 'inventory.changed' || type === 'offer.changed' || type === 'category.changed') setTick((t) => t + 1); });

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === '') next.delete(k); else next.set(k, v); });
    if (!('page' in patch)) next.delete('page');
    router.push(pathname + (next.toString() ? '?' + next.toString() : ''), { scroll: false });
  };
  const activeCat = cats.find((c) => c.slug === category);
  const title = q ? `Results for “${q}”` : activeCat ? activeCat.name : onOffer ? 'On offer' : featured ? 'Featured' : 'Shop all';

  return (
    <div>
      {data?.items?.some((p: any) => p.isDemo) ? <DemoBanner /> : null}
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-text">{data ? `${data.total} item${data.total === 1 ? '' : 's'}` : 'Catalog'}</p>
        <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{title}</h1>

        <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
          <aside aria-label="Filters" className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() || null }); }} role="search">
              <label htmlFor="cat-search" className="text-sm font-medium">Search</label>
              <div className="mt-1 flex gap-2">
                <input id="cat-search" className={inputCls + ' mt-0'} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or brand" />
                <button type="submit" className={btnGhost}>Go</button>
              </div>
            </form>
            <fieldset>
              <legend className="text-sm font-medium">Category</legend>
              <ul className="mt-2 flex flex-wrap gap-2 md:flex-col md:items-stretch">
                <li><button onClick={() => update({ category: null })} aria-pressed={!category} className={`w-full rounded-full px-3 py-1.5 text-left text-sm md:rounded-lg ${!category ? 'bg-primary text-on-primary' : 'hover:bg-soft'}`}>All categories</button></li>
                {cats.map((c) => (
                  <li key={c.id}><button onClick={() => update({ category: c.slug })} aria-pressed={category === c.slug} className={`w-full rounded-full px-3 py-1.5 text-left text-sm md:rounded-lg ${category === c.slug ? 'bg-primary text-on-primary' : 'hover:bg-soft'}`}>{c.name}</button></li>
                ))}
              </ul>
            </fieldset>
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); update({ minRs: min || null, maxRs: max || null }); }}>
              <fieldset>
                <legend className="text-sm font-medium">Price (Rs)</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted">Min<input inputMode="numeric" className={inputCls + ' mt-1'} value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Minimum price in rupees" /></label>
                  <label className="text-xs text-muted">Max<input inputMode="numeric" className={inputCls + ' mt-1'} value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Maximum price in rupees" /></label>
                </div>
              </fieldset>
              <button type="submit" className={btnGhost + ' w-full'}>Apply price</button>
            </form>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={onOffer} onChange={(e) => update({ onOffer: e.target.checked ? 'true' : null })} /> On offer only
            </label>
          </aside>

          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted" aria-live="polite">{data ? `Showing ${data.items.length} of ${data.total}` : ' '}</p>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Sort</span>
                <select className="rounded-full border border-line bg-surface px-3 py-2 text-sm" value={sort} onChange={(e) => update({ sort: e.target.value })}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            {err ? <ErrorState message="We could not load products." onRetry={() => setTick((t) => t + 1)} /> : null}
            {!err && !data ? <GridSkeleton n={8} /> : null}
            {data && !data.items.length ? (
              <EmptyState title="No products match these filters" body="Try a different search or clear the filters." action={{ label: 'Clear filters', href: '/products' }} />
            ) : null}
            {data?.items?.length ? (
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 fade-in">
                {data.items.map((p: any) => <li key={p.id}><ProductCard p={p} /></li>)}
              </ul>
            ) : null}
            {data ? <Pager page={page} pageSize={pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10"><GridSkeleton n={8} /></div>}><CatalogInner /></Suspense>;
}
