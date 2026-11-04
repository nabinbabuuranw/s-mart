import Link from 'next/link';
import { money } from '@/lib/api';
import { ProductImage } from './ProductImage';

export function ProductCard({ p }: { p: any }) {
  const v = p.variants?.[0];
  const onSale = v && v.listPrice > v.price;
  return (
    <Link href={`/products/${p.slug}`} className="group block rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-ink/30">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-soft">
        <ProductImage src={p.images?.[0]?.url} alt={p.images?.[0]?.alt || p.name} className="transition-transform duration-200 group-hover:scale-[1.03]" />
        {p.onOffer ? <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-ink">Offer</span> : null}
        {v && !v.available ? <span className="absolute bottom-2 left-2 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">Out of stock</span> : null}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted">{p.category?.name}</p>
        <h3 className="line-clamp-2 min-h-[2.6rem] text-[15px] font-medium leading-snug text-ink">{p.name}</h3>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-ink">{money(p.priceFrom)}</span>
          {onSale ? <s className="text-xs text-muted">{money(v.listPrice)}</s> : null}
        </div>
      </div>
    </Link>
  );
}
