import { test, expect, Page, request as pwRequest, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import AxeBuilder from '@axe-core/playwright';

const API = 'http://localhost:4100/api/v1';
const SHOTS = '/home/user/tab/files/smart/screenshots/customer';
const pw = (() => {
  if (process.env.SEED_DEMO_PASSWORD) return process.env.SEED_DEMO_PASSWORD;
  const m = fs.readFileSync('/home/user/tab/files/smart/s-mart/.env', 'utf8').match(/^SEED_DEMO_PASSWORD="?([^"\n]+)"?/m);
  return m![1];
})();
const CUSTOMER = 'customer2@smart.test';
const STAFF = 'admin@smart.test';
const CH = { 'X-Client': 'customer', 'X-CSRF': '1' };
const AH = { 'X-Client': 'admin', 'X-CSRF': '1' };

// The API limits logins per window, so each identity logs in once per run and the session is reused.
type Session = { req: APIRequestContext; state: any };
const sessions: Record<string, Session> = {};
async function session(email: string, audience: 'customer' | 'admin'): Promise<Session> {
  const key = audience + ':' + email;
  if (!sessions[key]) {
    const req = await pwRequest.newContext();
    let l = await req.post(API + '/auth/login', { headers: audience === 'admin' ? AH : CH, data: { email, password: pw, audience } });
    // The API throttles sign-ins per window; wait for the window to reset rather than fail the run.
    for (let i = 0; l.status() === 429 && i < 6; i++) {
      await new Promise((r) => setTimeout(r, 15000));
      l = await req.post(API + '/auth/login', { headers: audience === 'admin' ? AH : CH, data: { email, password: pw, audience } });
    }
    if (!l.ok()) throw new Error(`API sign-in failed: ${l.status()} ${await l.text()}`);
    sessions[key] = { req, state: await req.storageState() };
  }
  return sessions[key];
}
const custCall = async () => (await session(CUSTOMER, 'customer')).req;
const staffCall = async () => (await session(STAFF, 'admin')).req;

/** Signs the browser in with the cached cookie session (the same cookies the sign-in form sets). */
async function signIn(page: Page, email = CUSTOMER) {
  const s = await session(email, 'customer');
  await page.context().addCookies(s.state.cookies);
  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1, name: 'Your profile' })).toBeVisible({ timeout: 20000 });
}
async function pickAvailable(ctx: APIRequestContext) {
  const cat = await (await ctx.get(API + '/catalog/products?pageSize=50', { headers: { 'X-Client': 'customer' } })).json();
  for (const p of cat.items) for (const v of p.variants) if (v.available && !v.lowStock) return { p, v };
  throw new Error('no available variant in the seed');
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 70 });

test('sign in with the form reaches the account', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CUSTOMER);
  await page.getByLabel('Password').fill(pw);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Your profile' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel('Email')).toHaveValue(CUSTOMER);
});

test('home loads from the real API with hero, categories and product shelves', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Featured' })).toBeVisible();
  await expect(page.getByText('DEMO STORE: seeded test products, not for sale.').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('catalog search and category filter update the URL and the results', async ({ page }) => {
  await page.goto('/products');
  await expect(page.locator('ul[class*="grid"] > li').first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Stationery', exact: true }).click();
  await expect(page).toHaveURL(/category=stationery/);
  await expect(page.getByRole('heading', { level: 1, name: 'Stationery' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill('notebook');
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page).toHaveURL(/q=notebook/);
  await expect(page.getByText(/DEMO Notebook/).first()).toBeVisible({ timeout: 20000 });
  await page.goto('/products?q=zzz-no-such-item');
  await expect(page.getByText('No products match these filters')).toBeVisible({ timeout: 20000 });
});

test('product detail shows price and stock; a signed-out buyer is sent to sign in', async ({ page }) => {
  await page.goto('/products/demo-notebook-a5');
  await expect(page.getByRole('heading', { level: 1, name: 'DEMO Notebook A5 (set of 4)' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('In stock').or(page.getByText('Only a few left'))).toBeVisible();
  await page.getByRole('button', { name: 'Sign in to buy' }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('wrong password shows a plain error and stays on the login page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CUSTOMER);
  await page.getByLabel('Password').fill('not-the-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#form-error')).toContainText('do not match', { timeout: 15000 });
  await expect(page).toHaveURL(/\/login/);
});

test('customer buys with cash on delivery; staff sees it; tracking updates live', async ({ page }) => {
  const cust = await custCall();
  const staff = await staffCall();
  await cust.delete(API + '/me/cart', { headers: CH });
  const addrs = await (await cust.get(API + '/me/addresses', { headers: { 'X-Client': 'customer' } })).json();
  let addressId = addrs.find((a: any) => a.isDefault)?.id || addrs[0]?.id;
  if (!addressId) {
    const a = await (await cust.post(API + '/me/addresses', { headers: CH, data: { label: 'E2E', fullName: 'E2E Customer', phone: '9800000002', line1: 'Test Road 2', city: 'Inaruwa', isDefault: true } })).json();
    addressId = a.id;
  }
  const { p, v } = await pickAvailable(cust);
  await signIn(page);
  await page.goto(`/products/${p.slug}`);
  const add = page.getByRole('button', { name: 'Add to cart' });
  await expect(add).toBeEnabled({ timeout: 20000 });
  await add.click();
  await expect(page.getByText('Added 1 to your cart')).toBeVisible({ timeout: 15000 });

  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole('button', { name: /Place order/ })).toBeEnabled({ timeout: 20000 });
  await expect(page.getByText('Cash on delivery').first()).toBeVisible();
  await shot(page, 'checkout-cod');
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]+\?placed=1/, { timeout: 30000 });
  await expect(page.getByText('Your order is placed')).toBeVisible();
  const orderId = page.url().match(/orders\/([0-9a-f-]+)/)![1];
  const detail = await (await cust.get(`${API}/me/orders/${orderId}`, { headers: { 'X-Client': 'customer' } })).json();
  await expect(page.getByRole('heading', { level: 1, name: `Order ${detail.number}` })).toBeVisible();
  await shot(page, 'order-placed');

  // Staff sees the new order on the admin API and moves it forward.
  const found = await (await staff.get(`${API}/admin/orders?q=${detail.number}`, { headers: { 'X-Client': 'admin' } })).json();
  expect((found.items || found).some((o: any) => o.number === detail.number)).toBeTruthy();
  for (const status of ['confirmed', 'packed']) {
    const r = await staff.patch(`${API}/admin/orders/${orderId}/status`, { headers: AH, data: { status } });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  const ship = await staff.post(`${API}/admin/orders/${orderId}/ship`, { headers: AH, data: { carrier: 'E2E Courier', trackingNumber: 'E2E-' + detail.number } });
  expect(ship.ok(), await ship.text()).toBeTruthy();
  const out = await staff.patch(`${API}/admin/orders/${orderId}/status`, { headers: AH, data: { status: 'out_for_delivery' } });
  expect(out.ok(), await out.text()).toBeTruthy();
  // The customer's open tracking page updates without a reload.
  await expect(page.getByText('Status is now Out for delivery.')).toBeVisible({ timeout: 30000 });
  const del = await staff.patch(`${API}/admin/orders/${orderId}/status`, { headers: AH, data: { status: 'delivered' } });
  expect(del.ok(), await del.text()).toBeTruthy();
  await expect(page.getByText('Status is now Delivered.')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Paid on delivery')).toBeVisible();
  await shot(page, 'order-tracking-live');

  // Return request on the delivered order, from the customer's own page.
  await page.getByRole('button', { name: 'Request a return' }).click();
  const firstQty = page.getByRole('spinbutton', { name: /Quantity to return/ }).first();
  await firstQty.fill('1');
  await page.getByLabel('Why are you returning these?').fill('E2E check: returning one item for the return flow.');
  await page.getByRole('button', { name: 'Send return request' }).click();
  await expect(page.getByText('Return request sent')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Return requested/).first()).toBeVisible({ timeout: 20000 });
});

test('a placed order can be cancelled by the customer', async ({ page }) => {
  const cust = await custCall();
  const { v } = await pickAvailable(cust);
  const addrs = await (await cust.get(API + '/me/addresses', { headers: { 'X-Client': 'customer' } })).json();
  await cust.delete(API + '/me/cart', { headers: CH });
  const add = await cust.post(API + '/me/cart/items', { headers: CH, data: { variantId: v.id, quantity: 1 } });
  expect(add.ok(), await add.text()).toBeTruthy();
  const o = await cust.post(API + '/checkout', { headers: { ...CH, 'Idempotency-Key': crypto.randomUUID() }, data: { addressId: addrs.find((a: any) => a.isDefault)?.id || addrs[0].id, paymentMethod: 'cod' } });
  expect(o.ok(), await o.text()).toBeTruthy();
  const order = await o.json();
  await signIn(page);
  await page.goto(`/account/orders/${order.id}`);
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('button', { name: 'Yes, cancel order' }).click();
  await expect(page.getByText('Order cancelled')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
});

test('wishlist, address book, support ticket and notifications work for a signed-in customer', async ({ page }) => {
  await signIn(page);
  await page.goto('/products/demo-notebook-a5');
  await page.getByRole('button', { name: 'Save to wishlist' }).click();
  await expect(page.getByText('Saved to your wishlist')).toBeVisible({ timeout: 15000 });
  await page.goto('/account/wishlist');
  await expect(page.getByRole('heading', { level: 1, name: 'Your wishlist' })).toBeVisible();
  await expect(page.getByText('DEMO Notebook A5 (set of 4)')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Remove' }).first().click();

  await page.goto('/account/addresses');
  await page.getByRole('button', { name: 'Add address' }).click();
  await page.getByLabel('Full name').fill('Playwright Customer');
  await page.getByLabel('Phone').fill('9800000003');
  await page.getByLabel('Street or area').fill('Lane 9, Ward 4');
  await page.getByLabel('City or town').fill('Biratnagar');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('Address saved')).toBeVisible({ timeout: 15000 });

  await page.goto('/account/support');
  await page.getByRole('button', { name: 'New ticket' }).click();
  await page.getByLabel('Subject').fill('Playwright check: delivery time');
  await page.getByLabel('Message').fill('Testing the support form from the end-to-end suite.');
  await page.getByRole('button', { name: 'Send ticket' }).click();
  await expect(page).toHaveURL(/\/account\/support\/[0-9a-f-]+/, { timeout: 20000 });
  await expect(page.getByText('Testing the support form')).toBeVisible();
  await page.getByLabel('Reply').fill('Thanks, this is a test reply.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByText('Thanks, this is a test reply.')).toBeVisible({ timeout: 15000 });

  await page.goto('/account/notifications');
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
  await page.goto('/account/payments');
  await expect(page.getByRole('heading', { level: 1, name: 'Payment history' })).toBeVisible();
});

test('register creates an account and lands on the profile', async ({ page }) => {
  const email = `e2e.${Date.now()}@smart.test`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('E2E Newcomer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('a-long-passphrase-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Your profile' })).toBeVisible();
  await expect(page.locator('#pemail')).toHaveValue(email);
});

test('dark mode toggles and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('no horizontal overflow at 375px on key pages', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/', '/products', '/login', '/cart']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});

test('axe finds no serious or critical WCAG A/AA violations on key pages', async ({ page }) => {
  const scan = async (path: string, name: string, signed = false) => {
    if (signed) await signIn(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (bad.length) console.log(name, JSON.stringify(bad.map((b) => ({ id: b.id, impact: b.impact, nodes: b.nodes.length }))));
    expect(bad.map((b) => b.id), `${name}: serious/critical axe violations`).toEqual([]);
  };
  await scan('/', 'home');
  await scan('/products', 'catalog');
  await scan('/products/demo-notebook-a5', 'product');
  await scan('/login', 'login');
  await scan('/register', 'register');
  await scan('/cart', 'cart');
  await scan('/account/orders', 'orders', true);
});

test('screenshots of key pages at four widths', async ({ page }) => {
  await signIn(page);
  const pages: [string, string][] = [['/', 'home'], ['/products', 'catalog'], ['/products/demo-notebook-a5', 'product'], ['/cart', 'cart'], ['/account/orders', 'orders']];
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 812 : 900 });
    for (const [path, name] of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${SHOTS}/${name}-${width}.jpg`, type: 'jpeg', quality: 60 });
    }
  }
});
