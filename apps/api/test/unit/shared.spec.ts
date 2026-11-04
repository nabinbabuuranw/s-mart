import { applyOffer, bestUnitPrice, canTransition, computeTotals, customerCanCancel, hasPermission, nextStatuses, offerSchema, ORDER_STATUSES, ROLE_DEFINITIONS, PERMISSIONS, withinReturnWindow, formatNpr, checkoutSchema, registerSchema, hasAllPermissions } from '@smart/shared';
import { csvCell } from '../../src/reports/analytics.controller';
import { sniffImage } from '../../src/platform/platform.controller';
import { loadEnv } from '../../src/config/env';

const now = new Date();
const offer = (o: any = {}) => ({ type: 'percent' as const, value: 10, productIds: [], categoryIds: [], startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() + 86400000), active: true, ...o });

describe('pricing', () => {
  it('applies percent offers with integer floor', () => { expect(applyOffer(10001, { type: 'percent', value: 10 })).toBe(9000); });
  it('fixed offers never go below zero', () => { expect(applyOffer(500, { type: 'fixed', value: 900 })).toBe(0); });
  it('offers never raise the price', () => { expect(applyOffer(500, { type: 'fixed', value: -50 })).toBe(500); });
  it('rejects non-integer list prices', () => { expect(() => applyOffer(10.5, { type: 'percent', value: 10 })).toThrow(); });
  it('picks the lowest of several offers (no stacking)', () => { const r = bestUnitPrice(10000, 'p', 'c', [offer({ value: 10 }), offer({ value: 30 }), offer({ type: 'fixed', value: 500 })], now); expect(r.unitPrice).toBe(7000); });
  it('ignores expired, future and inactive offers', () => {
    const r = bestUnitPrice(10000, 'p', 'c', [offer({ endsAt: new Date(now.getTime() - 5) }), offer({ startsAt: new Date(now.getTime() + 5000) }), offer({ active: false })], now);
    expect(r.unitPrice).toBe(10000); expect(r.offer).toBeNull();
  });
  it('scopes offers to product or category', () => {
    const o = offer({ productIds: ['p1'] }); expect(bestUnitPrice(1000, 'p2', 'c', [o], now).unitPrice).toBe(1000); expect(bestUnitPrice(1000, 'p1', 'c', [o], now).unitPrice).toBe(900);
    const oc = offer({ categoryIds: ['c9'] }); expect(bestUnitPrice(1000, 'p2', 'c9', [oc], now).unitPrice).toBe(900);
  });
});
describe('totals', () => {
  const lines = [{ unitPrice: 10000, listPrice: 12000, quantity: 2 }, { unitPrice: 5000, listPrice: 5000, quantity: 1 }];
  it('sums lines, tracks offer savings, flat shipping', () => { expect(computeTotals({ lines, shippingFlat: 15000, freeShippingOver: null, taxBps: 0 })).toEqual({ subtotal: 25000, discountTotal: 4000, couponDiscount: 0, shippingFee: 15000, taxTotal: 0, total: 40000 }); });
  it('free shipping above the threshold', () => { expect(computeTotals({ lines, shippingFlat: 15000, freeShippingOver: 25000, taxBps: 0 }).shippingFee).toBe(0); });
  it('percent coupon honours minimum subtotal', () => {
    expect(computeTotals({ lines, coupon: { type: 'percent', value: 10, minSubtotal: 30000 }, shippingFlat: 0, freeShippingOver: null, taxBps: 0 }).couponDiscount).toBe(0);
    expect(computeTotals({ lines, coupon: { type: 'percent', value: 10, minSubtotal: 20000 }, shippingFlat: 0, freeShippingOver: null, taxBps: 0 }).couponDiscount).toBe(2500);
  });
  it('fixed coupon cannot exceed subtotal', () => { expect(computeTotals({ lines, coupon: { type: 'fixed', value: 99999999, minSubtotal: 0 }, shippingFlat: 0, freeShippingOver: null, taxBps: 0 }).total).toBe(0); });
  it('tax is computed on the discounted amount, rounded', () => { const t = computeTotals({ lines, coupon: { type: 'fixed', value: 5000, minSubtotal: 0 }, shippingFlat: 0, freeShippingOver: null, taxBps: 1300 }); expect(t.taxTotal).toBe(2600); expect(t.total).toBe(22600); });
  it('rejects invalid quantities and prices', () => {
    expect(() => computeTotals({ lines: [{ unitPrice: 1, listPrice: 1, quantity: 0 }], shippingFlat: 0, freeShippingOver: null, taxBps: 0 })).toThrow();
    expect(() => computeTotals({ lines: [{ unitPrice: -1, listPrice: 1, quantity: 1 }], shippingFlat: 0, freeShippingOver: null, taxBps: 0 })).toThrow();
  });
  it('empty cart has zero shipping', () => { expect(computeTotals({ lines: [], shippingFlat: 15000, freeShippingOver: null, taxBps: 0 }).total).toBe(0); });
  it('formats NPR', () => { expect(formatNpr(125000)).toBe('Rs. 1,250'); expect(formatNpr(12550)).toBe('Rs. 125.50'); });
});
describe('order state machine', () => {
  it('allows the happy path', () => { const path = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'return_requested', 'returned', 'refunded'] as const; for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true); });
  it('forbids skipping and going backwards', () => { expect(canTransition('placed', 'shipped')).toBe(false); expect(canTransition('delivered', 'placed')).toBe(false); expect(canTransition('shipped', 'cancelled')).toBe(false); });
  it('terminal states have no exits', () => { expect(nextStatuses('cancelled')).toEqual([]); expect(nextStatuses('refunded')).toEqual([]); });
  it('every status has a defined entry', () => { for (const s of ORDER_STATUSES) expect(Array.isArray(nextStatuses(s))).toBe(true); });
  it('customers can cancel only before packing', () => { expect(customerCanCancel('placed')).toBe(true); expect(customerCanCancel('confirmed')).toBe(true); expect(customerCanCancel('packed')).toBe(false); expect(customerCanCancel('delivered')).toBe(false); });
  it('return window', () => { const d = new Date(Date.now() - 6 * 86400000); expect(withinReturnWindow(d, 7)).toBe(true); expect(withinReturnWindow(d, 5)).toBe(false); expect(withinReturnWindow(null, 7)).toBe(false); });
});
describe('permissions', () => {
  it('wildcard grants everything', () => { expect(hasPermission(['*'], 'anything')).toBe(true); });
  it('exact match only', () => { expect(hasPermission(['orders.read'], 'orders.update')).toBe(false); expect(hasAllPermissions(['a', 'b'], ['a', 'b'])).toBe(true); expect(hasAllPermissions(['a'], ['a', 'b'])).toBe(false); });
  it('customer role has no staff permissions', () => { expect(ROLE_DEFINITIONS.customer.permissions).toEqual([]); expect(ROLE_DEFINITIONS.customer.isStaff).toBe(false); });
  it('every role permission exists in the catalogue', () => { for (const r of Object.values(ROLE_DEFINITIONS)) for (const p of r.permissions) if (p !== '*') expect(PERMISSIONS as readonly string[]).toContain(p); });
  it('only super_admin can manage roles', () => { const holders = Object.entries(ROLE_DEFINITIONS).filter(([, r]) => hasPermission(r.permissions, 'roles.manage')).map(([n]) => n); expect(holders).toEqual(['super_admin']); });
  it('finance cannot edit products; inventory cannot see orders', () => { expect(hasPermission(ROLE_DEFINITIONS.finance.permissions, 'products.write')).toBe(false); expect(hasPermission(ROLE_DEFINITIONS.inventory_staff.permissions, 'orders.read')).toBe(false); });
});
describe('validation schemas', () => {
  it('registration rejects extra fields such as role', () => { expect(registerSchema.safeParse({ email: 'a@b.co', password: 'longenough1', name: 'A', role: 'super_admin' }).success).toBe(false); });
  it('registration needs a 10+ char password', () => { expect(registerSchema.safeParse({ email: 'a@b.co', password: 'short', name: 'A' }).success).toBe(false); });
  it('checkout payload with a price field is rejected', () => { expect(checkoutSchema.safeParse({ addressId: '8a1e4c7e-3f1e-4c0e-8d0a-2f6b7a1f0001', total: 1 }).success).toBe(false); });
  it('percent offers are capped at 90', () => { const base = { title: 't', type: 'percent', value: 95, startsAt: '2026-01-01', endsAt: '2026-02-01' }; expect(offerSchema.safeParse(base).success).toBe(false); expect(offerSchema.safeParse({ ...base, value: 90 }).success).toBe(true); });
  it('offer end must follow start', () => { expect(offerSchema.safeParse({ title: 't', type: 'fixed', value: 5, startsAt: '2026-02-01', endsAt: '2026-01-01' }).success).toBe(false); });
});
describe('helpers', () => {
  it('csv escapes quotes and neutralises formulas', () => { expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)"); expect(csvCell('a,"b"')).toBe('"a,""b"""'); expect(csvCell('+1')).toBe("'+1"); expect(csvCell(5)).toBe('5'); });
  it('sniffs real image bytes only', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe('jpg');
    expect(sniffImage(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });
  it('env validation fails loudly on a short JWT secret', () => { expect(() => loadEnv({ DATABASE_URL: 'postgresql://a:b@h/db', JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/); });
  it('env validation accepts a complete config', () => { expect(loadEnv({ DATABASE_URL: 'postgresql://a:b@h/db', JWT_ACCESS_SECRET: 'x'.repeat(40) }).PORT).toBe(4100); });
});
