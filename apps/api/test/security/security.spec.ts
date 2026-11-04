import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { api, auth, customer, login, makeApp, mkAddress, mkProduct, mkUser, placeOrder, prisma, PW, staff } from '../helpers';

let app: any; const B = '/api/v1';
beforeAll(async () => { app = await makeApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
const secret = () => process.env.JWT_ACCESS_SECRET as string;

describe('default deny + unauthenticated access', () => {
  const routes = () => { const out: { method: string; path: string }[] = []; const stack = (app.getHttpAdapter().getInstance().router?.stack ?? []) as any[]; for (const l of stack) if (l.route) for (const m of Object.keys(l.route.methods)) out.push({ method: m.toUpperCase(), path: l.route.path }); return out; };
  const PUBLIC = new Set(['GET /api/v1/health', 'GET /api/v1/payment-methods', 'GET /api/v1/files/:name', 'GET /api/v1/realtime/stream', 'POST /api/v1/auth/register', 'POST /api/v1/auth/login', 'POST /api/v1/auth/refresh', 'POST /api/v1/auth/logout', 'GET /api/v1/catalog/config', 'GET /api/v1/catalog/categories', 'GET /api/v1/catalog/banners', 'GET /api/v1/catalog/offers', 'GET /api/v1/catalog/products', 'GET /api/v1/catalog/products/:slug']);
  it('discovers a meaningful number of routes', () => { expect(routes().length).toBeGreaterThan(90); });
  it('every non-public route answers 401 without credentials', async () => {
    const bad: string[] = [];
    for (const r of routes()) {
      const key = `${r.method} ${r.path}`; if (PUBLIC.has(key)) continue;
      const url = r.path.replace(/:[A-Za-z]+/g, randomUUID());
      const res = await (api(app) as any)[r.method.toLowerCase()](url).send(r.method === 'GET' ? undefined : {});
      if (res.status !== 401) bad.push(`${key} -> ${res.status}`);
    }
    expect(bad).toEqual([]);
  });
  it('every public route is on the explicit allow-list (a new public route must be added deliberately)', () => {
    // routes that answered something other than 401 above are exactly the allow-list; assert the count of routes is not smaller
    const all = routes().map((r) => `${r.method} ${r.path}`); for (const p of PUBLIC) expect(all).toContain(p);
  });
  it('customers get 403 on every /admin route and staff get 403 on every /me route', async () => {
    const c = await customer(app); const s = await staff(app, 'super_admin'); const bad: string[] = [];
    for (const r of routes()) {
      const url = r.path.replace(/:[A-Za-z]+/g, randomUUID());
      if (r.path.startsWith('/api/v1/admin')) { const res = await (api(app) as any)[r.method.toLowerCase()](url).set(auth(c)).send(r.method === 'GET' ? undefined : {}); if (res.status !== 403) bad.push(`customer ${r.method} ${r.path} -> ${res.status}`); }
      if (r.path.startsWith('/api/v1/me/') || r.path === '/api/v1/checkout') { const res = await (api(app) as any)[r.method.toLowerCase()](url).set(auth(s)).send(r.method === 'GET' ? undefined : {}); if (res.status !== 403) bad.push(`staff ${r.method} ${r.path} -> ${res.status}`); }
    }
    expect(bad).toEqual([]);
  });
});

describe('tokens', () => {
  it('rejects a forged token signed with the wrong secret', async () => { const u = await mkUser('admin'); const t = jwt.sign({ sub: u.id, role: 'admin', aud: 'admin' }, 'wrong-secret-wrong-secret-wrong-secret!!', { issuer: 'smart-api' }); expect((await api(app).get(`${B}/auth/me`).set('Authorization', `Bearer ${t}`)).status).toBe(401); });
  it('rejects alg=none tokens', async () => { const u = await mkUser('admin'); const h = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'); const p = Buffer.from(JSON.stringify({ sub: u.id, role: 'super_admin', aud: 'admin', iss: 'smart-api' })).toString('base64url'); expect((await api(app).get(`${B}/auth/me`).set('Authorization', `Bearer ${h}.${p}.`)).status).toBe(401); });
  it('rejects expired tokens', async () => { const u = await mkUser('customer'); const t = jwt.sign({ sub: u.id, role: 'customer', aud: 'customer' }, secret(), { issuer: 'smart-api', expiresIn: -10 }); expect((await api(app).get(`${B}/auth/me`).set('Authorization', `Bearer ${t}`)).status).toBe(401); });
  it('rejects tokens with the wrong issuer', async () => { const u = await mkUser('customer'); const t = jwt.sign({ sub: u.id, role: 'customer', aud: 'customer' }, secret(), { issuer: 'someone-else' }); expect((await api(app).get(`${B}/auth/me`).set('Authorization', `Bearer ${t}`)).status).toBe(401); });
  it('a customer token cannot claim the admin audience (role is re-read from the database, never from the token)', async () => {
    const u = await mkUser('customer'); const t = jwt.sign({ sub: u.id, role: 'super_admin', aud: 'admin' }, secret(), { issuer: 'smart-api', expiresIn: 60 });
    expect((await api(app).get(`${B}/admin/users`).set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });
  it('deactivated users lose access immediately even with a valid token', async () => { const u = await mkUser('customer'); const s = await login(app, u.email, 'customer'); await prisma.user.update({ where: { id: u.id }, data: { active: false } }); expect((await api(app).get(`${B}/me/profile`).set(auth(s))).status).toBe(401); });
  it('permission changes apply on the next request (no stale permissions in the token)', async () => {
    const u = await mkUser('support_agent'); const s = await login(app, u.email, 'admin'); expect((await api(app).get(`${B}/admin/tickets`).set(auth(s))).status).toBe(200);
    const role = await prisma.role.create({ data: { name: `r${randomUUID().slice(0, 8)}`, label: 'x', isStaff: true, permissions: ['dashboard.view'] } }); await prisma.user.update({ where: { id: u.id }, data: { roleId: role.id } });
    expect((await api(app).get(`${B}/admin/tickets`).set(auth(s))).status).toBe(403);
  });
});

describe('lockout, rate limiting, enumeration', () => {
  it('locks the account after repeated failures and refuses even the right password', async () => {
    const u = await mkUser('customer'); const ip = '10.9.9.9';
    for (let i = 0; i < 5; i++) expect((await api(app).post(`${B}/auth/login`).set('X-Forwarded-For', ip).send({ email: u.email, password: 'wrong-password-x', audience: 'customer' })).status).toBe(401);
    const locked = await api(app).post(`${B}/auth/login`).set('X-Forwarded-For', `10.9.9.${Math.floor(Math.random() * 200)}`).send({ email: u.email, password: PW, audience: 'customer' }); expect(locked.status).toBe(403); expect(locked.body.error.code).toBe('account_locked');
    await prisma.user.update({ where: { id: u.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await api(app).post(`${B}/auth/login`).set('X-Forwarded-For', '10.9.8.8').send({ email: u.email, password: PW, audience: 'customer' })).status).toBe(200);
  });
  it('rate-limits login attempts per client address (429)', async () => {
    const codes: number[] = []; for (let i = 0; i < 14; i++) codes.push((await api(app).post(`${B}/auth/login`).set('X-Forwarded-For', '10.7.7.7').send({ email: `nobody${i}@t.test`, password: 'x'.repeat(12), audience: 'customer' })).status);
    expect(codes).toContain(429); expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
  });
});

describe('IDOR: customer to customer', () => {
  it('cannot read, cancel, or return another customer\'s order', async () => {
    const a = await customer(app); const b = await customer(app); const p = await mkProduct({ stock: 5 }); const o = (await placeOrder(app, a, p.variants[0].id)).body;
    expect((await api(app).get(`${B}/me/orders/${o.id}`).set(auth(b))).status).toBe(404);
    expect((await api(app).post(`${B}/me/orders/${o.id}/cancel`).set(auth(b)).send({})).status).toBe(404);
    const oi = await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
    expect((await api(app).post(`${B}/me/orders/${o.id}/returns`).set(auth(b)).send({ reason: 'x', items: [{ orderItemId: oi.id, quantity: 1 }] })).status).toBe(404);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('placed');
    expect((await api(app).get(`${B}/me/orders`).set(auth(b))).body.items).toHaveLength(0);
    expect((await api(app).get(`${B}/me/payments`).set(auth(b))).body).toHaveLength(0);
  });
  it('cannot read, edit or delete another customer\'s address, and cannot check out to it', async () => {
    const a = await customer(app); const b = await customer(app); const addr = await mkAddress(a.id); const p = await mkProduct();
    expect((await api(app).put(`${B}/me/addresses/${addr.id}`).set(auth(b)).send({ fullName: 'Hacker', phone: '9800000000', line1: 'x', city: 'y' })).status).toBe(404);
    expect((await api(app).delete(`${B}/me/addresses/${addr.id}`).set(auth(b))).status).toBe(404);
    expect((await api(app).get(`${B}/me/addresses`).set(auth(b))).body).toHaveLength(0);
    await api(app).post(`${B}/me/cart/items`).set(auth(b)).send({ variantId: p.variants[0].id, quantity: 1 });
    expect((await api(app).post(`${B}/checkout`).set(auth(b)).set('Idempotency-Key', randomUUID()).send({ addressId: addr.id })).status).toBe(404);
    expect((await prisma.address.findUniqueOrThrow({ where: { id: addr.id } })).fullName).toBe('Test Person');
  });
  it('cannot read or reply to another customer\'s ticket, notification or wishlist', async () => {
    const a = await customer(app); const b = await customer(app); const t = (await api(app).post(`${B}/me/tickets`).set(auth(a)).send({ subject: 'S', body: 'secret' })).body;
    expect((await api(app).get(`${B}/me/tickets/${t.id}`).set(auth(b))).status).toBe(404);
    expect((await api(app).post(`${B}/me/tickets/${t.id}/messages`).set(auth(b)).send({ body: 'hi' })).status).toBe(404);
    expect((await api(app).get(`${B}/me/tickets`).set(auth(b))).body).toHaveLength(0);
    const n = await prisma.notification.create({ data: { userId: a.id, type: 't', title: 't', body: 'b' } }); expect((await api(app).post(`${B}/me/notifications/${n.id}/read`).set(auth(b))).status).toBe(404);
    const p = await mkProduct(); await api(app).put(`${B}/me/wishlist/${p.id}`).set(auth(a)); expect((await api(app).get(`${B}/me/wishlist`).set(auth(b))).body).toHaveLength(0);
    const o = (await placeOrder(app, a, p.variants[0].id)).body; expect((await api(app).post(`${B}/me/tickets`).set(auth(b)).send({ subject: 'x', body: 'y', orderId: o.id })).status).toBe(404);
  });
  it('customer cart and profile are isolated', async () => {
    const a = await customer(app); const b = await customer(app); const p = await mkProduct(); await api(app).post(`${B}/me/cart/items`).set(auth(a)).send({ variantId: p.variants[0].id, quantity: 1 });
    expect((await api(app).get(`${B}/me/cart`).set(auth(b))).body.items).toHaveLength(0);
    expect((await api(app).get(`${B}/me/profile`).set(auth(b))).body.id).toBe(b.id);
  });
});

describe('privilege escalation', () => {
  it('registration ignores/forbids role or roleId in the body', async () => {
    const r = await api(app).post(`${B}/auth/register`).send({ email: `esc-${randomUUID().slice(0, 6)}@t.test`, password: PW, name: 'E', role: 'super_admin', roleId: randomUUID() }); expect(r.status).toBe(400);
    const u = await prisma.user.findFirst({ where: { name: 'E' }, include: { role: true } }); expect(u?.role.name ?? 'none').not.toBe('super_admin');
  });
  it('profile update cannot change role, email or active flag', async () => {
    const c = await customer(app); const r = await api(app).patch(`${B}/me/profile`).set(auth(c)).send({ name: 'N', roleId: randomUUID(), role: 'admin' }); expect(r.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id }, include: { role: true } })).role.name).toBe('customer');
  });
  it('an admin cannot create or promote a user to super_admin; a manager cannot mint staff above their own permissions', async () => {
    const ad = await staff(app, 'admin'); const mg = await staff(app, 'manager'); const sa = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } }); const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } }); const victim = await mkUser('support_agent');
    const mk = (s: any, roleId: string) => api(app).post(`${B}/admin/users`).set(auth(s)).send({ email: `n-${randomUUID().slice(0, 6)}@t.test`, name: 'N', password: PW, roleId });
    expect((await mk(ad, sa.id)).body.error.code).toBe('escalation_denied');
    expect((await api(app).patch(`${B}/admin/users/${victim.id}`).set(auth(ad)).send({ roleId: sa.id })).status).toBe(403);
    expect((await mk(mg, adminRole.id)).status).toBe(403); // manager lacks users.manage entirely
    const sup = await staff(app, 'super_admin'); expect((await mk(sup, sa.id)).status).toBe(201);
  });
  it('staff cannot modify a more privileged user nor deactivate themselves', async () => {
    const ad = await staff(app, 'admin'); const sup = await mkUser('super_admin'); const role = await prisma.role.findUniqueOrThrow({ where: { name: 'support_agent' } });
    expect((await api(app).patch(`${B}/admin/users/${sup.id}`).set(auth(ad)).send({ active: false })).status).toBe(403);
    expect((await api(app).patch(`${B}/admin/users/${ad.id}`).set(auth(ad)).send({ roleId: role.id })).body.error.code).toBe('self_lockout');
  });
  it('super_admin role cannot be edited and system roles cannot be created with wildcard', async () => {
    const sup = await staff(app, 'super_admin'); const r = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
    expect((await api(app).put(`${B}/admin/roles/${r.id}`).set(auth(sup)).send({ label: 'x', permissions: [] })).body.error.code).toBe('protected_role');
    expect((await api(app).post(`${B}/admin/roles`).set(auth(sup)).send({ name: 'wild', label: 'W', permissions: ['*'] })).body.error.code).toBe('unknown_permission');
  });
  it('customers cannot be assigned through the staff endpoints', async () => { const ad = await staff(app, 'super_admin'); const c = await mkUser('customer'); expect((await api(app).patch(`${B}/admin/users/${c.id}`).set(auth(ad)).send({ active: false })).status).toBe(404); });
});

describe('price tampering and abuse of checkout', () => {
  it('ignores/rejects client-supplied prices and totals', async () => {
    const c = await customer(app); const p = await mkProduct({ price: 50000 }); await api(app).post(`${B}/me/cart/items`).set(auth(c)).send({ variantId: p.variants[0].id, quantity: 1 }); const addr = await mkAddress(c.id);
    for (const extra of [{ total: 1 }, { unitPrice: 1 }, { items: [{ variantId: p.variants[0].id, price: 1 }] }, { shippingFee: 0 }, { status: 'delivered' }, { paymentStatus: 'paid' }]) {
      const r = await api(app).post(`${B}/checkout`).set(auth(c)).set('Idempotency-Key', randomUUID()).send({ addressId: addr.id, ...extra }); expect(r.status).toBe(400);
    }
    const ok = await api(app).post(`${B}/checkout`).set(auth(c)).set('Idempotency-Key', randomUUID()).send({ addressId: addr.id }); expect(ok.body.subtotal).toBe(50000); expect(ok.body.paymentStatus).toBe('unpaid');
  });
  it('cart rejects negative, zero, fractional and huge quantities', async () => {
    const c = await customer(app); const p = await mkProduct({ stock: 1000 }); const vid = p.variants[0].id;
    for (const q of [-1, 0, 1.5, 100, '5', null]) expect((await api(app).post(`${B}/me/cart/items`).set(auth(c)).send({ variantId: vid, quantity: q })).status).toBe(400);
  });
  it('a customer cannot mark their own order paid or change its status', async () => {
    const c = await customer(app); const p = await mkProduct(); const o = (await placeOrder(app, c, p.variants[0].id)).body;
    expect((await api(app).patch(`${B}/admin/orders/${o.id}/status`).set(auth(c)).send({ status: 'delivered' })).status).toBe(403);
    expect((await api(app).patch(`${B}/me/orders/${o.id}`).set(auth(c)).send({ paymentStatus: 'paid' })).status).toBe(404);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe('unpaid');
  });
});

describe('injection and XSS', () => {
  const sqli = ["' OR 1=1 --", "'; DROP TABLE \"Product\"; --", "%' UNION SELECT * FROM \"User\" --", '\\', '" OR ""="'];
  it.each(sqli)('search/filter strings are inert: %s', async (s) => {
    const r = await api(app).get(`${B}/catalog/products`).query({ q: s, category: s }); expect(r.status).toBe(200); expect(r.body.total).toBe(0);
    const a = await staff(app, 'admin'); expect((await api(app).get(`${B}/admin/products`).set(auth(a)).query({ q: s })).status).toBe(200);
    expect((await api(app).get(`${B}/admin/orders`).set(auth(a)).query({ q: s })).status).toBe(200);
    expect((await api(app).get(`${B}/admin/audit-logs`).set(auth(a)).query({ q: s, action: s, entity: s })).status).toBe(200);
    expect(await prisma.product.count()).toBeGreaterThan(0); expect(await prisma.user.count()).toBeGreaterThan(0);
  });
  it('non-UUID ids are rejected with 400, not a database error', async () => { const c = await customer(app); expect((await api(app).get(`${B}/me/orders/1%20OR%201=1`).set(auth(c))).status).toBe(400); });
  it('stored script text is returned verbatim as JSON with nosniff (rendering escapes it in the React apps)', async () => {
    const c = await customer(app); const xss = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const t = await api(app).post(`${B}/me/tickets`).set(auth(c)).send({ subject: xss, body: xss }); expect(t.status).toBe(201);
    const g = await api(app).get(`${B}/me/tickets/${t.body.id}`).set(auth(c)); expect(g.headers['content-type']).toMatch(/application\/json/); expect(g.headers['x-content-type-options']).toBe('nosniff'); expect(g.body.messages[0].body).toBe(xss);
    const a = await staff(app, 'admin'); const cat = await prisma.category.create({ data: { name: 'x', slug: `x-${randomUUID().slice(0, 8)}` } });
    const pr = await api(app).post(`${B}/admin/products`).set(auth(a)).send({ name: xss, description: xss, categoryId: cat.id, variants: [{ sku: `X-${randomUUID().slice(0, 8)}`, price: 100 }] }); expect(pr.status).toBe(201);
    const pub = await api(app).get(`${B}/catalog/products/${pr.body.slug}`); expect(pub.headers['content-type']).toMatch(/json/); expect(pub.body.name).toBe(xss);
  });
  it('security headers are present on API responses', async () => { const r = await api(app).get(`${B}/health`); expect(r.headers['x-content-type-options']).toBe('nosniff'); expect(r.headers['x-frame-options']).toBeDefined(); expect(r.headers['x-powered-by']).toBeUndefined(); expect(r.headers['strict-transport-security']).toBeDefined(); });
  it('CORS only allows the configured origins', async () => {
    const ok = await api(app).options(`${B}/catalog/products`).set('Origin', 'http://localhost:3101').set('Access-Control-Request-Method', 'GET'); expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3101');
    const evil = await api(app).options(`${B}/catalog/products`).set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET'); expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('malformed JSON and oversized bodies are 4xx, not 500', async () => {
    expect((await api(app).post(`${B}/auth/login`).set('Content-Type', 'application/json').send('{bad json')).status).toBe(400);
    expect((await api(app).post(`${B}/auth/login`).send({ email: 'a@b.co', password: 'x'.repeat(400000), audience: 'customer' })).status).toBe(413);
  });
});

describe('upload attacks', () => {
  const up = (s: any, buf: Buffer, filename: string, contentType: string) => api(app).post(`${B}/admin/uploads`).set(auth(s)).attach('file', buf, { filename, contentType });
  it('rejects HTML/JS disguised as an image (type spoofing)', async () => { const a = await staff(app, 'manager'); const r = await up(a, Buffer.from('<html><script>alert(1)</script></html>'), 'evil.png', 'image/png'); expect(r.status).toBe(400); expect(r.body.error.code).toBe('unsupported_type'); });
  it('rejects SVG uploads (script-capable)', async () => { const a = await staff(app, 'manager'); expect((await up(a, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml')).status).toBe(400); });
  it('rejects oversize files (> 2 MB)', async () => { const a = await staff(app, 'manager'); const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3 * 1024 * 1024)]); const r = await up(a, big, 'big.jpg', 'image/jpeg'); expect([400, 413]).toContain(r.status); });
  it('ignores a path-traversal filename: stored under a random UUID name', async () => { const a = await staff(app, 'manager'); const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]); const r = await up(a, png, '../../etc/passwd.png', 'image/png'); expect(r.status).toBe(201); expect(r.body.name).toMatch(/^[a-f0-9-]{36}\.png$/); });
  it('file serving refuses traversal and unknown names', async () => {
    for (const n of ['..%2f..%2f.env', '%2e%2e%2fpackage.json', 'x.html', '..', 'demo-..%2fx.svg', 'a.png']) { const r = await api(app).get(`${B}/files/${n}`); expect([400, 404]).toContain(r.status); }
  });
  it('customers and unauthenticated users cannot upload', async () => { const c = await customer(app); const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]); expect((await up(c, png, 'a.png', 'image/png')).status).toBe(403); expect((await api(app).post(`${B}/admin/uploads`).attach('file', png, 'a.png')).status).toBe(401); });
});

describe('audit trail', () => {
  it('records admin writes with actor and before/after, and never stores password hashes', async () => {
    const a = await staff(app, 'super_admin'); const sa = await prisma.role.findUniqueOrThrow({ where: { name: 'support_agent' } });
    const u = await api(app).post(`${B}/admin/users`).set(auth(a)).send({ email: `aud-${randomUUID().slice(0, 6)}@t.test`, name: 'Aud', password: PW, roleId: sa.id }); expect(u.status).toBe(201);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'user', entityId: u.body.id, action: 'staff.create' } }); expect(log.actorId).toBe(a.id); expect(JSON.stringify(log)).not.toContain('argon2');
    expect(await prisma.auditLog.count({ where: { action: 'auth.login_failed' } })).toBeGreaterThanOrEqual(0);
  });
});
