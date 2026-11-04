'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, errorText, money } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/Toast';
import { useRealtime } from '@/lib/realtime';
import { IconHeart, IconMinus, IconPlus, IconBack } from '@/components/Icons';
import { DemoBanner, ErrorState, Skeleton, btnPrimary, btnGhost } from '@/components/ui';
import { ProductImage } from '@/components/ProductImage';

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(String(params.slug));
  const { user } = useAuth();
  const { reload } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [variantId, setVariantId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [wished, setWished] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setErr(null); setNotFound(false);
    api<any>('/catalog/products/' + encodeURIComponent(slug), { quiet: true }).then((d) => {
      setP(d);
      const firstAvail = d.variants?.find((v: any) => v.available) || d.variants?.[0];
      setVariantId((cur) => (cur && d.variants.some((v: any) => v.id === cur) ? cur : firstAvail?.id || ''));
    }).catch((e: any) => { if (e?.status === 404) setNotFound(true); else setErr(errorText(e)); });
  }, [slug, tick]);

  useEffect(() => {
    if (!user || !p) { setWished(null); return; }
    api<any>('/me/wishlist', { quiet: true }).then((list) => {
      const arr = Array.isArray(list) ? list : list?.items || [];
      setWished(arr.some((x: any) => (x.productId ?? x.id ?? x.product?.id) === p.id));
    }).catch(() => setWished(null));
  }, [user, p]);

  useRealtime({}, (type) => { if (type === 'product.updated' || type === 'inventory.changed' || type === 'offer.changed') setTick((t) => t + 1); });

  const variant = useMemo(() => p?.variants?.find((v: any) => v.id === variantId), [p, variantId]);
  const maxQty = variant?.available ? 99 : 0;

  const addToCart = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/products/${slug}`)); return; }
    if (!variant?.available) return;
    setBusy(true);
    try {
      await api('/me/cart/items', { method: 'POST', body: { variantId: variant.id, quantity: qty } });
      await reload();
      toast.show(`Added ${qty} to your cart`, 'ok');
    } catch (e) { toast.show(errorText(e), 'error'); }
    finally { setBusy(false); }
  };
  const toggleWish = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/products/${slug}`)); return; }
    const next = !wished;
    setWished(next);
    try {
      await api(`/me/wishlist/${p.id}`, { method: next ? 'PUT' : 'DELETE' });
      toast.show(next ? 'Saved to your wishlist' : 'Removed from your wishlist', 'ok');
    } catch (e) { setWished(!next); toast.show(errorText(e), 'error'); }
  };

  if (notFound) return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">That product is not here</h1>
      <p className="mt-2 text-muted">It may have been removed or the link is out of date.</p>
      <Link href="/products" className={`${btnPrimary} mt-6`}>Back to shop</Link>
    </div>
  );
  if (err) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState message={err} onRetry={() => setTick((t) => t + 1)} /></div>;
  if (!p) return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2 md:px-6" aria-busy="true">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/4" /><Skeleton className="h-24 w-full" /></div>
    </div>
  );

  const images = p.images?.length ? p.images : [];
  const onSale = variant && variant.listPrice > variant.price;
  return (
    <div>
      {p.isDemo ? <DemoBanner /> : null}
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link href="/products" className="inline-flex items-center gap-1 hover:text-ink"><IconBack className="h-4 w-4" />Shop</Link>
          {p.category ? <> <span aria-hidden="true">/</span> <Link href={`/products?category=${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link></> : null}
        </nav>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-soft">
              {images[img] ? <ProductImage key={images[img].id} src={images[img].url} alt={images[img].alt || p.name} className="fade-in" /> : <div className="flex h-full items-center justify-center text-muted">No photo yet</div>}
            </div>
            {images.length > 1 ? (
              <ul className="mt-3 flex gap-2" aria-label="Photos">
                {images.map((im: any, i: number) => (
                  <li key={im.id}><button onClick={() => setImg(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={img === i}
                    className={`h-16 w-16 overflow-hidden rounded-lg border ${img === i ? 'border-ink' : 'border-line'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" className="h-full w-full object-cover" /></button></li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{p.brand || p.category?.name}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">{p.name}</h1>
            <div className="mt-4 flex flex-wrap items-baseline gap-3" aria-live="polite">
              <span className="text-2xl font-semibold">{variant ? money(variant.price) : money(p.priceFrom)}</span>
              {onSale ? <s className="text-muted">{money(variant.listPrice)}</s> : null}
              {variant?.offer ? <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-text">{variant.offer.title}</span> : null}
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{p.description}</p>

            {p.variants?.length > 1 ? (
              <fieldset className="mt-6">
                <legend className="text-sm font-medium">Choose an option</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.variants.map((v: any) => (
                    <label key={v.id} className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${v.id === variantId ? 'border-ink bg-primary text-on-primary' : 'border-line bg-surface'} ${!v.available ? 'opacity-50' : ''}`}>
                      <input type="radio" name="variant" className="sr-only" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} />
                      {v.name} · {money(v.price)}{!v.available ? ' (out of stock)' : ''}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="mt-6" aria-live="polite">
              {variant ? (variant.available
                ? <p className="text-sm text-success">{variant.lowStock ? 'Only a few left' : 'In stock'}</p>
                : <p className="text-sm text-danger">Out of stock right now</p>) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-line bg-surface" role="group" aria-label="Quantity">
                <button className="p-3 hover:bg-soft disabled:opacity-40" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><IconMinus className="h-4 w-4" /></button>
                <span className="min-w-[2.5rem] text-center font-medium" aria-live="polite">{qty}</span>
                <button className="p-3 hover:bg-soft disabled:opacity-40" onClick={() => setQty(Math.min(maxQty || 1, qty + 1))} disabled={!variant?.available || qty >= maxQty} aria-label="Increase quantity"><IconPlus className="h-4 w-4" /></button>
              </div>
              <button className={btnPrimary + ' flex-1 md:flex-none md:px-8'} onClick={addToCart} disabled={busy || !variant?.available}>
                {busy ? 'Adding…' : user ? 'Add to cart' : 'Sign in to buy'}
              </button>
              <button onClick={toggleWish} className={btnGhost} aria-pressed={!!wished} aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}>
                <IconHeart className={`h-5 w-5 ${wished ? 'fill-current text-accent-text' : ''}`} />
              </button>
            </div>
            <p className="mt-6 text-sm text-muted">Cash on delivery. Totals, shipping and tax are calculated by the store at checkout.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
