'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { ProductCard } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { DemoBanner, EmptyState, ErrorState, GridSkeleton, Skeleton, btnPrimary, btnGhost } from '@/components/ui';

export default function HomePage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  const load = () => {
    setErr(false);
    Promise.all([
      api<any[]>('/catalog/banners?placement=home_hero', { quiet: true }),
      api<any[]>('/catalog/categories', { quiet: true }),
      api<any>('/catalog/products?featured=true&pageSize=8', { quiet: true }),
      api<any>('/catalog/products?onOffer=true&pageSize=4', { quiet: true }),
      api<any>('/catalog/products?sort=newest&pageSize=8', { quiet: true }),
    ]).then(([banners, categories, featured, offers, fresh]) => setData({ banners, categories, featured: featured.items, offers: offers.items, fresh: fresh.items }))
      .catch(() => setErr(true));
  };
  useEffect(() => { load(); }, [tick]);
  useRealtime({}, (type) => { if (['product.updated', 'product.created', 'product.deleted', 'banner.changed', 'category.changed', 'offer.changed', 'inventory.changed'].includes(type)) setTick((t) => t + 1); });

  const hero = data?.banners?.[0];
  const isDemo = data?.fresh?.some((p: any) => p.isDemo) || data?.featured?.some((p: any) => p.isDemo);
  return (
    <div>
      {isDemo ? <DemoBanner /> : null}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pt-14">
        {!data && !err ? <Skeleton className="h-64 w-full rounded-3xl md:h-80" /> : null}
        {err ? <ErrorState message="We could not load the store just now." onRetry={() => { setData(null); setTick((t) => t + 1); }} /> : null}
        {data ? (
          <div className="grid items-center gap-8 rounded-3xl border border-line bg-surface p-7 md:grid-cols-2 md:p-12 fade-in">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent-text">{hero ? 'This week' : 'Welcome to S Mart'}</p>
              <h1 className="mt-3 text-4xl font-semibold leading-[1.1] md:text-5xl">{hero?.title || 'Everyday stationery and home goods, delivered.'}</h1>
              <p className="mt-4 max-w-md text-muted">{hero?.subtitle || 'Pay in cash when it arrives. Track every order live from your account.'}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={hero?.linkUrl || '/products'} className={btnPrimary}>Shop now</Link>
                <Link href="/products?onOffer=true" className={btnGhost}>See offers</Link>
              </div>
            </div>
            <div className="hidden rounded-2xl bg-soft md:block md:aspect-[4/3]">
              {hero?.imageUrl ? <ProductImage src={hero.imageUrl} alt="" className="rounded-2xl" /> : null}
            </div>
          </div>
        ) : null}
      </section>

      {data?.categories?.length ? (
        <section className="mx-auto max-w-7xl px-4 md:px-6" aria-labelledby="cats">
          <h2 id="cats" className="mb-4 text-2xl font-semibold">Shop by category</h2>
          <ul className="flex flex-wrap gap-2">
            {data.categories.map((c: any) => (
              <li key={c.id}><Link href={`/products?category=${c.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-soft">{c.name}<span className="text-xs text-muted">{c._count?.products ?? ''}</span></Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      <Shelf title="On offer" href="/products?onOffer=true" items={data?.offers} loading={!data && !err} />
      <Shelf title="Featured" href="/products?featured=true" items={data?.featured} loading={!data && !err} />
      <Shelf title="New arrivals" href="/products?sort=newest" items={data?.fresh} loading={!data && !err} />
      {data && !data.featured?.length && !data.fresh?.length ? (
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6"><EmptyState title="Nothing on the shelves yet" body="New products will show here as they are added." action={{ label: 'Browse all', href: '/products' }} /></div>
      ) : null}
      <div className="h-6" />
    </div>
  );
}

function Shelf({ title, href, items, loading }: { title: string; href: string; items?: any[]; loading: boolean }) {
  if (!loading && !items?.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:px-6" aria-labelledby={`shelf-${title}`}>
      <div className="mb-5 flex items-end justify-between">
        <h2 id={`shelf-${title}`} className="text-2xl font-semibold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-accent-text hover:underline">See all</Link>
      </div>
      {loading ? <GridSkeleton n={4} /> : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">{items!.map((p) => <li key={p.id}><ProductCard p={p} /></li>)}</ul>
      )}
    </section>
  );
}
