import { randomUUID } from 'crypto';
import http from 'http';
import { api, auth, customer, login, makeApp, mkAddress, mkCategory, mkProduct, mkUser, placeOrder, prisma, PW, staff } from '../helpers';

let app: any; const B = '/api/v1';
beforeAll(async () => { app = await makeApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });

describe('auth', () => {
  it('registers a customer, returns tokens and /me', async () => {
    const email = `reg-${randomUUID().slice(0, 8)}@t.test`;
    const r = await api(app).post(`${B}/auth/register`).send({ email, password: PW, name: 'Reg User' });
    expect(r.status).toBe(201); expect(r.body.user.role).toBe('customer'); expect(r.body.user.isStaff).toBe(false);
    const me = await api(app).get(`${B}/auth/me`).set('Authorization', `Bearer ${r.body.accessToken}`); expect(me.body.email).toBe(email);
  });
  it('duplicate email is a 409', async () => {
    const u = await mkUser('customer'); const r = await api(app).post(`${B}/auth/register`).send({ email: u.email, password: PW, name: 'X' }); expect(r.status).toBe(409);
  });
  it('wrong password and unknown email give the same 401 body', async () => {
    const u = await mkUser('customer');
    const a = await api(app).post(`${B}/auth/login`).send({ email: u.email, password: 'nope-nope-nope', audience: 'customer' });
    const b = await api(app).post(`${B}/auth/login`).send({ email: 'nobody@t.test', password: 'nope-nope-nope', audience: 'customer' });
    expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.body.error.message).toBe(b.body.error.message);
  });
  it('staff cannot log in on the customer audience and vice versa', async () => {
    const s = await mkUser('admin'); const c = await mkUser('customer');
    expect((await api(app).post(`${B}/auth/login`).send({ email: s.email, password: PW, audience: 'customer' })).status).toBe(401);
    expect((await api(app).post(`${B}/auth/login`).send({ email: c.email, password: PW, audience: 'admin' })).status).toBe(401);
  });
  it('rotates refresh tokens and detects reuse (kills the family)', async () => {
    const u = await mkUser('customer'); const s = await login(app, u.email, 'customer');
    const r1 = await api(app).post(`${B}/auth/refresh`).send({ refreshToken: s.refresh }); expect(r1.status).toBe(200); expect(r1.body.refreshToken).not.toBe(s.refresh);
    const reuse = await api(app).post(`${B}/auth/refresh`).send({ refreshToken: s.refresh }); expect(reuse.status).toBe(401);
    const afterKill = await api(app).post(`${B}/auth/refresh`).send({ refreshToken: r1.body.refreshToken }); expect(afterKill.status).toBe(401);
  });
  it('logout revokes the refresh token', async () => {
    const u = await mkUser('customer'); const s = await login(app, u.email, 'customer');
    expect((await api(app).post(`${B}/auth/logout`).send({ refreshToken: s.refresh })).status).toBe(204);
    expect((await api(app).post(`${B}/auth/refresh`).send({ refreshToken: s.refresh })).status).toBe(401);
  });
  it('web cookie mode sets httpOnly cookies and enforces the CSRF header on writes', async () => {
    const u = await mkUser('customer');
    const r = await api(app).post(`${B}/auth/login`).set('X-Client', 'customer').send({ email: u.email, password: PW, audience: 'customer' });
    const cookies = (r.headers['set-cookie'] as unknown as string[]); expect(cookies.some((c) => c.startsWith('sm_customer_at=') && /HttpOnly/i.test(c) && /SameSite=Strict/i.test(c))).toBe(true);
    const jar = cookies.map((c) => c.split(';')[0]).join('; ');
    expect((await api(app).get(`${B}/me/profile`).set('X-Client', 'customer').set('Cookie', jar)).status).toBe(200);
    expect((await api(app).patch(`${B}/me/profile`).set('X-Client', 'customer').set('Cookie', jar).send({ name: 'N' })).status).toBe(403);
    expect((await api(app).patch(`${B}/me/profile`).set('X-Client', 'customer').set('X-CSRF', '1').set('Cookie', jar).send({ name: 'N' })).status).toBe(200);
  });
  it('password change revokes sessions', async () => {
    const u = await mkUser('customer'); const s = await login(app, u.email, 'customer');
    expect((await api(app).patch(`${B}/auth/password`).set(auth(s)).send({ currentPassword: PW, newPassword: 'Another-Pass-9999' })).status).toBe(204);
    expect((await api(app).post(`${B}/auth/refresh`).send({ refreshToken: s.refresh })).status).toBe(401);
    expect((await api(app).post(`${B}/auth/login`).send({ email: u.email, password: 'Another-Pass-9999', audience: 'customer' })).status).toBe(200);
  });
});

describe('catalog', () => {
  it('lists, searches (case-insensitive), filters by category and price, paginates', async () => {
    const cat = await mkCategory('Search'); const tag = randomUUID().slice(0, 6);
    await mkProduct({ category: cat.id, price: 5000, name: `Zebra ${tag} cheap` }); await mkProduct({ category: cat.id, price: 90000, name: `Zebra ${tag} pricey` });
    const q = await api(app).get(`${B}/catalog/products`).query({ q: `ZEBRA ${tag}` }); expect(q.body.total).toBe(2);
    const slug = (await prisma.category.findUniqueOrThrow({ where: { id: cat.id } })).slug;
    const f = await api(app).get(`${B}/catalog/products`).query({ category: slug, minPrice: 10000, sort: 'price_asc' }); expect(f.body.total).toBe(1); expect(f.body.items[0].name).toContain('pricey');
    const p = await api(app).get(`${B}/catalog/products`).query({ category: slug, pageSize: 1, page: 2 }); expect(p.body.items).toHaveLength(1); expect(p.body.total).toBe(2);
  });
  it('hides inactive and deleted products and exposes only availability, not raw stock', async () => {
    const p = await mkProduct({ stock: 4 }); const res = await api(app).get(`${B}/catalog/products/${p.slug}`);
    expect(res.status).toBe(200); expect(res.body.variants[0].available).toBe(true); expect(res.body.variants[0].stock).toBeUndefined();
    await prisma.product.update({ where: { id: p.id }, data: { active: false } });
    expect((await api(app).get(`${B}/catalog/products/${p.slug}`)).status).toBe(404);
  });
  it('applies an active offer to the effective price and ignores an expired one', async () => {
    const p = await mkProduct({ price: 10000 }); const day = 86400000;
    await prisma.offer.create({ data: { title: 'Live', type: 'percent', value: 20, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day), productIds: [p.id] } });
    await prisma.offer.create({ data: { title: 'Old', type: 'percent', value: 80, startsAt: new Date(Date.now() - 3 * day), endsAt: new Date(Date.now() - 2 * day), productIds: [p.id] } });
    const v = (await api(app).get(`${B}/catalog/products/${p.slug}`)).body.variants[0]; expect(v.price).toBe(8000); expect(v.listPrice).toBe(10000); expect(v.offer.title).toBe('Live');
  });
});

describe('admin catalog + RBAC', () => {
  it('admin creates a product, writes an audit row, and the public catalog shows it', async () => {
    const a = await staff(app, 'admin'); const cat = await mkCategory();
    const r = await api(app).post(`${B}/admin/products`).set(auth(a)).send({ name: `Made ${randomUUID().slice(0, 5)}`, categoryId: cat.id, variants: [{ sku: `S-${randomUUID().slice(0, 8)}`, price: 12345, stock: 7 }] });
    expect(r.status).toBe(201);
    expect((await api(app).get(`${B}/catalog/products/${r.body.slug}`)).body.variants[0].price).toBe(12345);
    const logs = await prisma.auditLog.findMany({ where: { entity: 'product', entityId: r.body.id, action: 'product.create' } }); expect(logs).toHaveLength(1);
    const ledger = await prisma.stockMovement.findMany({ where: { variantId: r.body.variants[0].id } }); expect(ledger[0].reason).toBe('initial'); expect(ledger[0].balanceAfter).toBe(7);
  });
  it('validation errors list the failing fields', async () => {
    const a = await staff(app, 'admin'); const r = await api(app).post(`${B}/admin/products`).set(auth(a)).send({ name: '', categoryId: 'nope', variants: [] });
    expect(r.status).toBe(400); expect(r.body.error.code).toBe('validation_error'); expect(r.body.error.details.length).toBeGreaterThan(1);
  });
  it('inventory adjust writes a ledger row and refuses negative stock', async () => {
    const a = await staff(app, 'inventory_staff'); const p = await mkProduct({ stock: 3 }); const vid = p.variants[0].id;
    expect((await api(app).post(`${B}/admin/inventory/${vid}/adjust`).set(auth(a)).send({ delta: 5, note: 'recount' })).status).toBe(201);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: vid } })).stock).toBe(8);
    expect((await api(app).post(`${B}/admin/inventory/${vid}/adjust`).set(auth(a)).send({ delta: -9 })).status).toBe(400);
    expect((await api(app).get(`${B}/admin/inventory/${vid}/ledger`).set(auth(a))).body.length).toBe(1);
  });
  it('inventory staff cannot touch orders or pricing; finance cannot edit products', async () => {
    const inv = await staff(app, 'inventory_staff'); const fin = await staff(app, 'finance');
    expect((await api(app).get(`${B}/admin/orders`).set(auth(inv))).status).toBe(403);
    expect((await api(app).post(`${B}/admin/offers`).set(auth(inv)).send({})).status).toBe(403);
    expect((await api(app).post(`${B}/admin/products`).set(auth(fin)).send({})).status).toBe(403);
    expect((await api(app).get(`${B}/admin/analytics/summary`).set(auth(fin))).status).toBe(200);
  });
  it('offers, coupons and banners CRUD', async () => {
    const a = await staff(app, 'manager'); const p = await mkProduct();
    const o = await api(app).post(`${B}/admin/offers`).set(auth(a)).send({ title: 'T', type: 'percent', value: 15, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86400000), productIds: [p.id] }); expect(o.status).toBe(201);
    expect((await api(app).put(`${B}/admin/offers/${o.body.id}`).set(auth(a)).send({ title: 'T2', type: 'percent', value: 25, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86400000), productIds: [p.id] })).status).toBe(200);
    expect((await api(app).post(`${B}/admin/offers`).set(auth(a)).send({ title: 'bad', type: 'percent', value: 99, startsAt: new Date(), endsAt: new Date(Date.now() + 1000) })).status).toBe(400);
    const c = await api(app).post(`${B}/admin/coupons`).set(auth(a)).send({ code: `c${randomUUID().slice(0, 5)}`, type: 'fixed', value: 1000 }); expect(c.status).toBe(201); expect(c.body.code).toMatch(/^C/);
    const b = await api(app).post(`${B}/admin/banners`).set(auth(a)).send({ title: 'Banner', placement: 'home_strip' }); expect(b.status).toBe(201);
    expect((await api(app).get(`${B}/catalog/banners`).query({ placement: 'home_strip' })).body.some((x: any) => x.id === b.body.id)).toBe(true);
    expect((await api(app).delete(`${B}/admin/banners/${b.body.id}`).set(auth(a))).status).toBe(200);
  });
});

describe('cart + checkout', () => {
  it('prices the cart on the server with offers, shipping and totals', async () => {
    const c = await customer(app); const p = await mkProduct({ price: 10000, stock: 10 });
    const r = await api(app).post(`${B}/me/cart/items`).set(auth(c)).send({ variantId: p.variants[0].id, quantity: 3 });
    expect(r.status).toBe(201); expect(r.body.subtotal).toBe(30000); expect(r.body.shippingFee).toBe(15000); expect(r.body.total).toBe(45000);
  });
  it('refuses to add more than the stock', async () => { const c = await customer(app); const p = await mkProduct({ stock: 2 }); expect((await api(app).post(`${B}/me/cart/items`).set(auth(c)).send({ variantId: p.variants[0].id, quantity: 3 })).status).toBe(400); });
  it('places a COD order: totals, stock decrement, ledger, cart cleared, notifications, status placed/unpaid', async () => {
    const c = await customer(app); const p = await mkProduct({ price: 25000, stock: 5 });
    const r = await placeOrder(app, c, p.variants[0].id, 2);
    expect(r.status).toBe(201); expect(r.body.status).toBe('placed'); expect(r.body.paymentStatus).toBe('unpaid'); expect(r.body.subtotal).toBe(50000); expect(r.body.shippingFee).toBe(15000); expect(r.body.total).toBe(65000); expect(r.body.number).toMatch(/^SM-\d+$/);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(3);
    const mv = await prisma.stockMovement.findMany({ where: { variantId: p.variants[0].id, reason: 'sale' } }); expect(mv).toHaveLength(1); expect(mv[0].refId).toBe(r.body.id); expect(mv[0].balanceAfter).toBe(3);
    expect((await api(app).get(`${B}/me/cart`).set(auth(c))).body.items).toHaveLength(0);
    expect(await prisma.notification.count({ where: { userId: c.id, type: 'order.status' } })).toBe(1);
    expect(await prisma.notification.count({ where: { audience: 'staff', type: 'order.created', data: { path: ['orderId'], equals: r.body.id } } })).toBe(1);
  });
  it('is idempotent: the same key returns the same order and decrements stock once', async () => {
    const c = await customer(app); const p = await mkProduct({ price: 10000, stock: 5 });
    await api(app).post(`${B}/me/cart/items`).set(auth(c)).send({ variantId: p.variants[0].id, quantity: 1 }); const addr = await mkAddress(c.id); const key = randomUUID();
    const a = await api(app).post(`${B}/checkout`).set(auth(c)).set('Idempotency-Key', key).send({ addressId: addr.id });
    const b = await api(app).post(`${B}/checkout`).set(auth(c)).set('Idempotency-Key', key).send({ addressId: addr.id });
    expect(a.body.id).toBe(b.body.id); expect(b.body.idempotentReplay).toBe(true);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(4);
  });
  it('simultaneous double-submit with one key creates exactly one order', async () => {
    const c = await customer(app); const p = await mkProduct({ price: 10000, stock: 5 });
    await api(app).post(`${B}/me/cart/items`).set(auth(c)).send({ variantId: p.variants[0].id, quantity: 1 }); const addr = await mkAddress(c.id); const key = randomUUID();
    const rs = await Promise.all([1, 2, 3].map(() => api(app).post(`${B}/checkout`).set(auth(c)).set('Idempotency-Key', key).send({ addressId: addr.id })));
    expect(await prisma.order.count({ where: { userId: c.id } })).toBe(1);
    expect(rs.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(4);
  });
  it('requires an Idempotency-Key', async () => { const c = await customer(app); const addr = await mkAddress(c.id); expect((await api(app).post(`${B}/checkout`).set(auth(c)).send({ addressId: addr.id })).status).toBe(400); });
  it('never oversells under concurrency: 12 buyers, 5 units -> exactly 5 orders', async () => {
    const p = await mkProduct({ price: 10000, stock: 5 }); const buyers = await Promise.all(Array.from({ length: 12 }, () => customer(app)));
    const results = await Promise.all(buyers.map((c) => placeOrder(app, c, p.variants[0].id, 1)));
    const ok = results.filter((r) => r.status === 201).length; const conflict = results.filter((r) => r.status === 409 || r.status === 400).length;
    expect(ok).toBe(5); expect(ok + conflict).toBe(12);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(0);
    const sum = await prisma.stockMovement.aggregate({ where: { variantId: p.variants[0].id }, _sum: { delta: true } }); expect(sum._sum.delta).toBe(-5);
  });
  it('applies a coupon server-side and enforces limits', async () => {
    const c = await customer(app); const p = await mkProduct({ price: 100000, stock: 5 }); const code = `CP${randomUUID().slice(0, 6).toUpperCase()}`;
    await prisma.coupon.create({ data: { code, type: 'percent', value: 10, minSubtotal: 50000, maxUses: 1 } });
    const r = await placeOrder(app, c, p.variants[0].id, 1, { couponCode: code }); expect(r.status).toBe(201); expect(r.body.couponDiscount).toBe(10000); expect(r.body.total).toBe(105000);
    const c2 = await customer(app); const r2 = await placeOrder(app, c2, p.variants[0].id, 1, { couponCode: code }); expect(r2.status).toBe(400); expect(r2.body.error.code).toBe('invalid_coupon');
  });
  it('rejects payment methods that are not configured', async () => { const c = await customer(app); const p = await mkProduct(); const r = await placeOrder(app, c, p.variants[0].id, 1, { paymentMethod: 'esewa' }); expect(r.status).toBe(400); expect(r.body.error.code).toBe('payment_method_unavailable'); });
  it('empty cart cannot check out', async () => { const c = await customer(app); const addr = await mkAddress(c.id); expect((await api(app).post(`${B}/checkout`).set(auth(c)).set('Idempotency-Key', randomUUID()).send({ addressId: addr.id })).body.error.code).toBe('cart_empty'); });
});

describe('order lifecycle, returns, refunds', () => {
  async function delivered() {
    const c = await customer(app); const p = await mkProduct({ price: 40000, stock: 6 }); const ops = await staff(app, 'manager');
    const o = (await placeOrder(app, c, p.variants[0].id, 2)).body;
    for (const s of ['confirmed', 'packed']) expect((await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ops)).send({ status: s })).status).toBe(200);
    const sh = await api(app).post(`${B}/admin/orders/${o.id}/ship`).set(auth(ops)).send({ carrier: 'Local courier', trackingNumber: 'TRK1' }); expect(sh.status).toBe(200); expect(sh.body.status).toBe('shipped'); expect(sh.body.shipments).toHaveLength(1);
    const d = await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ops)).send({ status: 'delivered' }); expect(d.status).toBe(200);
    return { c, p, o, ops, d: d.body };
  }
  it('walks placed -> delivered, COD turns paid only on delivery, timeline recorded', async () => {
    const { d } = await delivered(); expect(d.paymentStatus).toBe('paid'); expect(d.payments[0].status).toBe('paid'); expect(d.payments[0].verifiedAt).toBeTruthy();
    expect(d.events.map((e: any) => e.status)).toEqual(['placed', 'confirmed', 'packed', 'shipped', 'delivered']);
  });
  it('rejects invalid transitions', async () => {
    const c = await customer(app); const p = await mkProduct(); const ops = await staff(app, 'order_staff'); const o = (await placeOrder(app, c, p.variants[0].id)).body;
    const r = await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ops)).send({ status: 'delivered' }); expect(r.status).toBe(400); expect(r.body.error.code).toBe('invalid_transition');
    expect((await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ops)).send({ status: 'refunded' })).status).toBe(400);
  });
  it('order_staff lacks orders.cancel so cannot cancel', async () => { const c = await customer(app); const p = await mkProduct(); const ops = await staff(app, 'order_staff'); const o = (await placeOrder(app, c, p.variants[0].id)).body; expect((await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ops)).send({ status: 'cancelled' })).status).toBe(403); });
  it('customer cancels an eligible order: stock restored, ledger row, coupon released', async () => {
    const c = await customer(app); const p = await mkProduct({ stock: 4 }); const o = (await placeOrder(app, c, p.variants[0].id, 3)).body;
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(1);
    const r = await api(app).post(`${B}/me/orders/${o.id}/cancel`).set(auth(c)).send({ reason: 'changed my mind' }); expect(r.status).toBe(200); expect(r.body.status).toBe('cancelled');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(4);
    expect(await prisma.stockMovement.count({ where: { variantId: p.variants[0].id, reason: 'cancel_restock' } })).toBe(1);
    expect((await api(app).post(`${B}/me/orders/${o.id}/cancel`).set(auth(c)).send({})).status).toBe(400);
  });
  it('customer cannot cancel once packed', async () => {
    const c = await customer(app); const p = await mkProduct(); const ops = await staff(app, 'manager'); const o = (await placeOrder(app, c, p.variants[0].id)).body;
    await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ops)).send({ status: 'confirmed' }); await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ops)).send({ status: 'packed' });
    const r = await api(app).post(`${B}/me/orders/${o.id}/cancel`).set(auth(c)).send({}); expect(r.status).toBe(400); expect(r.body.error.code).toBe('not_cancellable');
  });
  it('return -> approve -> received -> refund with restock; cannot over-refund or restock twice', async () => {
    const { c, p, o, ops } = await delivered(); const fin = await staff(app, 'finance');
    const oi = (await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } }));
    const r = await api(app).post(`${B}/me/orders/${o.id}/returns`).set(auth(c)).send({ reason: 'Damaged', items: [{ orderItemId: oi.id, quantity: 1 }] }); expect(r.status).toBe(201);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('return_requested');
    expect((await api(app).post(`${B}/admin/returns/${r.body.id}/decision`).set(auth(ops)).send({ decision: 'received' })).status).toBe(400);
    expect((await api(app).post(`${B}/admin/returns/${r.body.id}/decision`).set(auth(ops)).send({ decision: 'approve' })).status).toBe(200);
    expect((await api(app).post(`${B}/admin/returns/${r.body.id}/decision`).set(auth(ops)).send({ decision: 'received' })).status).toBe(200);
    const before = (await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock;
    expect((await api(app).post(`${B}/admin/orders/${o.id}/refunds`).set(auth(fin)).send({ amount: 40000, reason: 'Return', restock: true, returnId: r.body.id })).status).toBe(201);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(before + 1);
    const ord = await prisma.order.findUniqueOrThrow({ where: { id: o.id } }); expect(ord.refundedTotal).toBe(40000); expect(ord.paymentStatus).toBe('partially_refunded');
    expect((await api(app).post(`${B}/admin/orders/${o.id}/refunds`).set(auth(fin)).send({ amount: 55001, reason: 'too much' })).body.error.code).toBe('refund_exceeds_total');
    expect((await api(app).post(`${B}/admin/orders/${o.id}/refunds`).set(auth(fin)).send({ amount: 10, reason: 'x', restock: true, returnId: r.body.id })).body.error.code).toBe('already_restocked');
    expect((await api(app).post(`${B}/admin/orders/${o.id}/refunds`).set(auth(fin)).send({ amount: 55000, reason: 'rest' })).status).toBe(201);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('refunded');
  });
  it('concurrent refunds cannot exceed the order total', async () => {
    const { o } = await delivered(); const fin = await staff(app, 'finance');
    const rs = await Promise.all([1, 2, 3, 4].map(() => api(app).post(`${B}/admin/orders/${o.id}/refunds`).set(auth(fin)).send({ amount: 40000, reason: 'race' })));
    expect(rs.filter((r) => r.status === 201).length).toBe(2); expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).refundedTotal).toBe(80000);
  });
  it('returns need delivered status, a valid item, and a quantity within what was bought', async () => {
    const c = await customer(app); const p = await mkProduct(); const o = (await placeOrder(app, c, p.variants[0].id)).body; const oi = await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
    expect((await api(app).post(`${B}/me/orders/${o.id}/returns`).set(auth(c)).send({ reason: 'x', items: [{ orderItemId: oi.id, quantity: 1 }] })).body.error.code).toBe('not_returnable');
    const d = await delivered(); const di = await prisma.orderItem.findFirstOrThrow({ where: { orderId: d.o.id } });
    expect((await api(app).post(`${B}/me/orders/${d.o.id}/returns`).set(auth(d.c)).send({ reason: 'x', items: [{ orderItemId: di.id, quantity: 9 }] })).body.error.code).toBe('bad_quantity');
    expect((await api(app).post(`${B}/me/orders/${d.o.id}/returns`).set(auth(d.c)).send({ reason: 'x', items: [{ orderItemId: oi.id, quantity: 1 }] })).body.error.code).toBe('bad_item');
  });
  it('return window closes', async () => {
    const d = await delivered(); await prisma.order.update({ where: { id: d.o.id }, data: { deliveredAt: new Date(Date.now() - 30 * 86400000) } }); const di = await prisma.orderItem.findFirstOrThrow({ where: { orderId: d.o.id } });
    expect((await api(app).post(`${B}/me/orders/${d.o.id}/returns`).set(auth(d.c)).send({ reason: 'late', items: [{ orderItemId: di.id, quantity: 1 }] })).body.error.code).toBe('return_window_closed');
  });
  it('unpaid orders cannot be refunded', async () => { const c = await customer(app); const p = await mkProduct(); const fin = await staff(app, 'finance'); const o = (await placeOrder(app, c, p.variants[0].id)).body; expect((await api(app).post(`${B}/admin/orders/${o.id}/refunds`).set(auth(fin)).send({ amount: 100, reason: 'x' })).body.error.code).toBe('not_paid'); });
});

describe('customer features', () => {
  it('addresses: CRUD, default switching, soft delete', async () => {
    const c = await customer(app); const base = { fullName: 'A B', phone: '9800000000', line1: 'L1', city: 'Inaruwa' };
    const a1 = await api(app).post(`${B}/me/addresses`).set(auth(c)).send(base); expect(a1.body.isDefault).toBe(true);
    const a2 = await api(app).post(`${B}/me/addresses`).set(auth(c)).send({ ...base, isDefault: true }); expect(a2.body.isDefault).toBe(true);
    const list = (await api(app).get(`${B}/me/addresses`).set(auth(c))).body; expect(list.filter((x: any) => x.isDefault)).toHaveLength(1);
    expect((await api(app).delete(`${B}/me/addresses/${a1.body.id}`).set(auth(c))).status).toBe(200); expect((await api(app).get(`${B}/me/addresses`).set(auth(c))).body).toHaveLength(1);
  });
  it('wishlist add/list/remove', async () => { const c = await customer(app); const p = await mkProduct(); await api(app).put(`${B}/me/wishlist/${p.id}`).set(auth(c)); expect((await api(app).get(`${B}/me/wishlist`).set(auth(c))).body[0].id).toBe(p.id); await api(app).delete(`${B}/me/wishlist/${p.id}`).set(auth(c)); expect((await api(app).get(`${B}/me/wishlist`).set(auth(c))).body).toHaveLength(0); });
  it('support tickets: customer opens, staff replies, customer sees reply but not internal notes', async () => {
    const c = await customer(app); const s = await staff(app, 'support_agent');
    const t = await api(app).post(`${B}/me/tickets`).set(auth(c)).send({ subject: 'Help', body: 'Where is my parcel?' }); expect(t.status).toBe(201);
    expect((await api(app).post(`${B}/admin/tickets/${t.body.id}/messages`).set(auth(s)).send({ body: 'internal only', internal: true })).status).toBe(201);
    expect((await api(app).post(`${B}/admin/tickets/${t.body.id}/messages`).set(auth(s)).send({ body: 'On its way' })).status).toBe(201);
    const view = await api(app).get(`${B}/me/tickets/${t.body.id}`).set(auth(c)); expect(view.body.messages.map((m: any) => m.body)).toEqual(['Where is my parcel?', 'On its way']);
    expect((await api(app).get(`${B}/me/notifications`).set(auth(c))).body.unread).toBeGreaterThanOrEqual(1);
  });
});

describe('admin: users, roles, settings, audit, analytics, reports, backups, uploads', () => {
  it('super admin manages roles; admin cannot', async () => {
    const sa = await staff(app, 'super_admin'); const ad = await staff(app, 'admin');
    const r = await api(app).post(`${B}/admin/roles`).set(auth(sa)).send({ name: `r${randomUUID().slice(0, 6)}`, label: 'Custom', permissions: ['orders.read'] }); expect(r.status).toBe(201);
    expect((await api(app).post(`${B}/admin/roles`).set(auth(ad)).send({ name: 'xyz', label: 'X', permissions: ['orders.read'] })).status).toBe(403);
    expect((await api(app).post(`${B}/admin/roles`).set(auth(sa)).send({ name: 'badrole', label: 'X', permissions: ['not.real'] })).body.error.code).toBe('unknown_permission');
  });
  it('settings update changes shipping on the next order and is audited', async () => {
    const ad = await staff(app, 'admin'); const c = await customer(app); const p = await mkProduct({ price: 10000 });
    expect((await api(app).put(`${B}/admin/settings`).set(auth(ad)).send({ shippingFlat: 5000 })).body.shippingFlat).toBe(5000);
    expect((await api(app).post(`${B}/me/cart/items`).set(auth(c)).send({ variantId: p.variants[0].id, quantity: 1 })).body.shippingFee).toBe(5000);
    expect((await api(app).put(`${B}/admin/settings`).set(auth(ad)).send({ shippingFlat: 15000 })).status).toBe(200);
    expect((await api(app).put(`${B}/admin/settings`).set(auth(ad)).send({ nonsense: 1 })).status).toBe(400);
    expect((await api(app).get(`${B}/admin/audit-logs`).set(auth(ad)).query({ action: 'settings.update' })).body.total).toBeGreaterThanOrEqual(2);
  });
  it('analytics summary reflects real orders', async () => {
    const ad = await staff(app, 'admin'); const c = await customer(app); const p = await mkProduct({ price: 70000 }); await placeOrder(app, c, p.variants[0].id, 1);
    const s = (await api(app).get(`${B}/admin/analytics/summary`).set(auth(ad)).query({ days: 7 })).body;
    expect(s.orders).toBeGreaterThanOrEqual(1); expect(s.revenue).toBeGreaterThanOrEqual(70000); expect(s.series).toHaveLength(7); expect(s.byStatus.placed).toBeGreaterThanOrEqual(1);
  });
  it.each(['csv', 'xlsx', 'pdf'])('exports the sales report as %s', async (format) => {
    const ad = await staff(app, 'admin'); const r = await api(app).get(`${B}/admin/reports/sales`).set(auth(ad)).query({ format }).buffer(true).parse((res, cb) => { const d: Buffer[] = []; res.on('data', (x: Buffer) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(r.status).toBe(200); const b: Buffer = r.body;
    if (format === 'pdf') expect(b.subarray(0, 4).toString()).toBe('%PDF'); if (format === 'xlsx') expect(b.subarray(0, 2).toString()).toBe('PK'); if (format === 'csv') expect(b.toString()).toContain('Order,Date,Customer');
  });
  it('upload accepts a real PNG and serves it with nosniff', async () => {
    const ad = await staff(app, 'manager'); const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const r = await api(app).post(`${B}/admin/uploads`).set(auth(ad)).attach('file', png, { filename: 'x.png', contentType: 'image/png' }); expect(r.status).toBe(201);
    const g = await api(app).get(r.body.url); expect(g.status).toBe(200); expect(g.headers['content-type']).toBe('image/png'); expect(g.headers['x-content-type-options']).toBe('nosniff');
  });
  it('backup: dump then verify by restoring into a scratch database', async () => {
    const sa = await staff(app, 'super_admin'); const b = await api(app).post(`${B}/admin/backups`).set(auth(sa)); expect(b.status).toBe(201);
    const v = await api(app).post(`${B}/admin/backups/${b.body.name}/verify`).set(auth(sa)); expect(v.status).toBe(200); expect(v.body.ok).toBe(true); expect(v.body.restored.User).toBeGreaterThan(0);
    expect((await api(app).get(`${B}/admin/backups`).set(auth(sa))).body.items.length).toBeGreaterThanOrEqual(1);
    expect((await api(app).get(`${B}/admin/backups`).set(auth(await staff(app, 'admin')))).status).toBe(200);
    expect((await api(app).get(`${B}/admin/backups`).set(auth(await staff(app, 'finance')))).status).toBe(403);
  });
});

describe('realtime', () => {
  function openStream(port: number, path: string, onEvent: (t: string, d: any) => void) {
    return new Promise<http.ClientRequest>((resolve, reject) => {
      const req = http.get({ port, path, headers: { Accept: 'text/event-stream' } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error('status ' + res.statusCode));
        let buf = ''; res.setEncoding('utf8');
        res.on('data', (c) => { buf += c; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const block = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /event: (.*)/.exec(block)?.[1]; const data = /data: (.*)/.exec(block)?.[1]; if (ev) onEvent(ev, data ? JSON.parse(data) : null); } });
        resolve(req);
      }); req.on('error', reject);
    });
  }
  const waitFor = async (cond: () => boolean, ms = 4000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error('timeout waiting for event'); await new Promise((r) => setTimeout(r, 25)); } };
  it('an admin price change reaches a subscribed customer client; private order events need a ticket', async () => {
    await app.listen(0); const port = app.getHttpServer().address().port;
    const ad = await staff(app, 'manager'); const c = await customer(app); const p = await mkProduct({ price: 10000 });
    const pub: any[] = []; const sreq = await openStream(port, `${B}/realtime/stream`, (t, d) => pub.push({ t, d }));
    const tk = (await api(app).post(`${B}/realtime/ticket`).set(auth(c))).body.ticket; const mine: any[] = []; const creq = await openStream(port, `${B}/realtime/stream?ticket=${tk}`, (t, d) => mine.push({ t, d }));
    const stk = (await api(app).post(`${B}/realtime/ticket`).set(auth(ad))).body.ticket; const ops: any[] = []; const areq = await openStream(port, `${B}/realtime/stream?ticket=${stk}`, (t, d) => ops.push({ t, d }));
    await waitFor(() => pub.some((e) => e.t === 'hello'));
    const upd = await api(app).patch(`${B}/admin/products/${p.id}`).set(auth(ad)).send({ variants: [{ id: p.variants[0].id, sku: p.variants[0].sku, name: 'Default', price: 7777, stock: 10, trackInventory: true, lowStockAt: 5, active: true }] }); expect(upd.status).toBe(200);
    await waitFor(() => pub.some((e) => e.t === 'product.updated' && e.d.id === p.id && e.d.priceChanged));
    expect((await api(app).get(`${B}/catalog/products/${p.slug}`)).body.variants[0].price).toBe(7777);
    const o = (await placeOrder(app, c, p.variants[0].id)).body;
    await waitFor(() => ops.some((e) => e.t === 'order.created' && e.d.orderId === o.id)); // staff see new orders live
    await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ad)).send({ status: 'confirmed' });
    await waitFor(() => mine.some((e) => e.t === 'order.updated' && e.d.orderId === o.id && e.d.status === 'confirmed')); // customer tracking updates live
    expect(pub.some((e) => e.t === 'order.created' || e.t === 'order.updated')).toBe(false); // anonymous stream never sees private events
    const other = await customer(app); const otk = (await api(app).post(`${B}/realtime/ticket`).set(auth(other))).body.ticket; const otherEv: any[] = []; const oreq = await openStream(port, `${B}/realtime/stream?ticket=${otk}`, (t, d) => otherEv.push({ t, d }));
    await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(ad)).send({ status: 'packed' }); await new Promise((r) => setTimeout(r, 300));
    expect(otherEv.some((e) => e.t === 'order.updated')).toBe(false);
    expect((await api(app).get(`${B}/realtime/stream?ticket=bogus`)).status).toBe(401);
    [sreq, creq, areq, oreq].forEach((r) => r.destroy());
  });
});
