export type OfferLike = { type: 'percent' | 'fixed'; value: number; productIds: string[]; categoryIds: string[]; startsAt: Date | string; endsAt: Date | string; active: boolean };

export function offerApplies(o: OfferLike, productId: string, categoryId: string, at: Date): boolean {
  if (!o.active) return false;
  if (at < new Date(o.startsAt) || at > new Date(o.endsAt)) return false;
  if (o.productIds.length === 0 && o.categoryIds.length === 0) return true;
  return o.productIds.includes(productId) || o.categoryIds.includes(categoryId);
}

/** Price after a single offer; integer minor units, never below 0, never above list. */
export function applyOffer(list: number, o: Pick<OfferLike, 'type' | 'value'>): number {
  if (!Number.isInteger(list) || list < 0) throw new Error('list price must be a non-negative integer');
  const p = o.type === 'percent' ? Math.floor((list * (100 - Math.min(Math.max(o.value, 0), 100))) / 100) : list - Math.max(o.value, 0);
  return Math.min(list, Math.max(0, p));
}

/** Lowest price among all applicable offers (offers do not stack). */
export function bestUnitPrice(list: number, productId: string, categoryId: string, offers: OfferLike[], at: Date) {
  let best = list; let offer: OfferLike | null = null;
  for (const o of offers) {
    if (!offerApplies(o, productId, categoryId, at)) continue;
    const p = applyOffer(list, o);
    if (p < best) { best = p; offer = o; }
  }
  return { unitPrice: best, offer };
}

export type CouponLike = { type: 'percent' | 'fixed'; value: number; minSubtotal: number };
export type TotalsInput = {
  lines: { unitPrice: number; listPrice: number; quantity: number }[];
  coupon?: CouponLike | null;
  shippingFlat: number;
  freeShippingOver: number | null;
  taxBps: number;
};
export type Totals = { subtotal: number; discountTotal: number; couponDiscount: number; shippingFee: number; taxTotal: number; total: number };

export function computeTotals(i: TotalsInput): Totals {
  for (const l of i.lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new Error('invalid quantity');
    if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) throw new Error('invalid price');
  }
  const subtotal = i.lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  const discountTotal = i.lines.reduce((a, l) => a + Math.max(0, l.listPrice - l.unitPrice) * l.quantity, 0);
  let couponDiscount = 0;
  if (i.coupon && subtotal >= i.coupon.minSubtotal && subtotal > 0) {
    couponDiscount = i.coupon.type === 'percent' ? Math.floor((subtotal * Math.min(i.coupon.value, 100)) / 100) : Math.min(i.coupon.value, subtotal);
  }
  const taxable = subtotal - couponDiscount;
  const shippingFee = subtotal === 0 ? 0 : i.freeShippingOver !== null && taxable >= i.freeShippingOver ? 0 : i.shippingFlat;
  const taxTotal = Math.round((taxable * i.taxBps) / 10000);
  return { subtotal, discountTotal, couponDiscount, shippingFee, taxTotal, total: taxable + shippingFee + taxTotal };
}

export const formatNpr = (minor: number) => 'Rs. ' + (minor / 100).toLocaleString('en-IN', { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 });
