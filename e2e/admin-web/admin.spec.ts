
import { test, expect, Page, request } from '@playwright/test';
import fs from 'fs';
const API = 'http://localhost:4100/api/v1';
const SHOTS = '/home/user/tab/files/smart/screenshots/admin';
function pw(){ if(process.env.SEED_DEMO_PASSWORD) return process.env.SEED_DEMO_PASSWORD;
  const m = fs.readFileSync('/home/user/tab/files/smart/s-mart/.env','utf8').match(/^SEED_DEMO_PASSWORD="?([^"\n]+)"?/m); return m![1]; }
const STATES:Record<string,any[]>={};
async function login(page: Page, email: string){ if(STATES[email]){ await page.context().addCookies(STATES[email]); await page.goto('/'); await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible({timeout:20000}); return; } await page.goto('/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(pw()); await page.getByRole('button',{name:'Sign in'}).click(); await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible({timeout:20000}); STATES[email]=await page.context().cookies(); }
async function placeOrder(){
  const H = {'X-Client':'customer','X-CSRF':'1'}; const ctx = await request.newContext();
  const l = await ctx.post(API+'/auth/login',{headers:H,data:{email:'customer2@smart.test',password:pw(),audience:'customer'}}); expect(l.ok()).toBeTruthy();
  const cat = await (await ctx.get(API+'/catalog/products?pageSize=50')).json();
  let vid=''; for(const p of cat.items) for(const v of p.variants) if(!vid && v.available && !v.lowStock) vid=v.id; if(!vid) for(const p of cat.items) for(const v of p.variants) if(!vid&&v.available) vid=v.id;
  expect(vid).not.toBe('');
  const addr = await (await ctx.post(API+'/me/addresses',{headers:H,data:{label:'E2E',fullName:'E2E Customer',phone:'9800000001',line1:'Test Road 2',city:'Inaruwa'}})).json();
  await ctx.delete(API+'/me/cart',{headers:H}); const a = await ctx.post(API+'/me/cart/items',{headers:H,data:{variantId:vid,quantity:1}}); expect(a.ok(), await a.text()).toBeTruthy();
  const o = await ctx.post(API+'/checkout',{headers:{...H,'Idempotency-Key':crypto.randomUUID()},data:{addressId:addr.id,paymentMethod:'cod'}}); expect(o.ok(), await o.text()).toBeTruthy();
  return await o.json();
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 62 });

test('login: wrong credentials show an error and stay on login', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('Email').fill('nobody@smart.test'); await page.getByLabel('Password').fill('wrong-password-123'); await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.locator('p[role=alert]')).toContainText(/incorrect|Too many/i); await expect(page).toHaveURL(/\/login/);
});
test('unauthenticated visit redirects to login', async ({ page }) => { await page.goto('/orders'); await expect(page).toHaveURL(/\/login/, {timeout:15000}); });
test('super admin sees full nav and dashboard analytics', async ({ page }) => {
  await login(page,'super@smart.test'); await expect(page.getByRole('heading',{name:'Dashboard'})).toBeVisible();
  for (const n of ['Orders','Products','Staff & roles','Settings','Audit log','Backups','Reports']) await expect(page.getByRole('navigation',{name:'Main'}).first().getByRole('link',{name:n})).toBeVisible();
  await expect(page.getByText('Revenue by day')).toBeVisible(); await expect(page.getByText('Pending returns')).toBeVisible();
});
test('category + product CRUD through the UI', async ({ page }) => {
  await login(page,'admin@smart.test'); const stamp = Date.now().toString().slice(-6);
  await page.goto('/categories'); await page.getByRole('button',{name:'New category'}).click(); await page.getByLabel('Name').fill('E2E Cat '+stamp); await page.getByRole('button',{name:'Save'}).click(); await expect(page.getByText('E2E Cat '+stamp)).toBeVisible();
  await page.goto('/products'); await page.getByRole('button',{name:'New product'}).click(); const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Name').first().fill('E2E Product '+stamp); await dlg.getByLabel('Category').selectOption({label:'E2E Cat '+stamp});
  await dlg.getByRole('button',{name:'Save product'}).click(); await expect(dlg.getByRole('alert')).toBeVisible(); // validation: price/sku missing
  await dlg.getByLabel('SKU').fill('E2E-'+stamp); await dlg.getByLabel('Price',{exact:true}).fill('1250'); await dlg.getByRole('textbox',{name:'Stock'}).fill('7'); await dlg.getByRole('button',{name:'Save product'}).click();
  await expect(page.getByText('E2E Product '+stamp)).toBeVisible({timeout:15000});
  // edit price, then it must show on the public catalogue API
  await page.getByRole('row',{name:new RegExp('E2E Product '+stamp)}).getByRole('button',{name:'Edit'}).click(); await page.getByRole('dialog').getByLabel('Price',{exact:true}).fill('999'); await page.getByRole('dialog').getByRole('button',{name:'Save product'}).click();
  await expect(page.getByRole('row',{name:new RegExp('E2E Product '+stamp)})).toContainText('999', {timeout:15000});
  const pub = await (await request.newContext()).get(API+'/catalog/products?q=E2E%20Product%20'+stamp); const j = await pub.json(); expect(j.items.length).toBe(1); expect(j.items[0].variants[0].price).toBe(99900);
  await page.getByRole('row',{name:new RegExp('E2E Product '+stamp)}).getByRole('button',{name:'Delete'}).click(); await page.getByRole('dialog').getByRole('button',{name:'Delete'}).click(); await expect(page.getByText('E2E Product '+stamp)).toHaveCount(0,{timeout:15000});
});
test('order_staff: nav hides restricted areas and direct visit is refused', async ({ page }) => {
  await login(page,'orders@smart.test'); const nav = page.getByRole('navigation',{name:'Main'}).first();
  await expect(nav.getByRole('link',{name:'Orders'})).toBeVisible(); for (const n of ['Settings','Staff & roles','Audit log','Backups','Products']) await expect(nav.getByRole('link',{name:n})).toHaveCount(0);
  await page.goto('/settings'); await expect(page.getByText('Your role does not include this area.')).toBeVisible();
});
test('support_agent: tickets visible, finance cannot see tickets', async ({ page }) => {
  await login(page,'support@smart.test'); await expect(page.getByRole('navigation',{name:'Main'}).first().getByRole('link',{name:'Support tickets'})).toBeVisible();
  await page.getByRole('button',{name:'Sign out'}).click(); await expect(page).toHaveURL(/\/login/);
  await login(page,'finance@smart.test'); await expect(page.getByRole('navigation',{name:'Main'}).first().getByRole('link',{name:'Support tickets'})).toHaveCount(0); await expect(page.getByRole('navigation',{name:'Main'}).first().getByRole('link',{name:'Payments'})).toBeVisible();
});
test('realtime: new customer order toasts live; admin confirms it; status updates', async ({ page }) => {
  await login(page,'orders@smart.test'); await page.goto('/orders'); await expect(page.getByText('Live',{exact:true})).toBeVisible({timeout:20000});
  const ord = await placeOrder(); const number = ord.number || ord.order?.number;
  await expect(page.getByText(/New order/).first()).toBeVisible({timeout:20000});
  await expect(page.getByRole('link',{name:number})).toBeVisible({timeout:20000});
  await page.getByRole('link',{name:number}).click(); await expect(page.getByRole('heading',{name:'Order '+number})).toBeVisible();
  await page.getByRole('button',{name:'Mark confirmed'}).click(); await expect(page.getByText('Status: confirmed')).toBeVisible({timeout:15000});
  await shot(page,'order-detail-1440-light');
});
test('reports: CSV export downloads a file', async ({ page }) => {
  await login(page,'finance@smart.test'); await page.goto('/reports'); const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('section',{hasText:'Sales'}).getByRole('button',{name:'CSV'}).click()]);
  expect(dl.suggestedFilename()).toMatch(/sales.*\.csv/); const p = await dl.path(); expect(fs.statSync(p!).size).toBeGreaterThan(10);
});
test('dark mode toggles and persists', async ({ page }) => {
  await login(page,'manager@smart.test'); await page.getByRole('button',{name:'Toggle dark mode'}).click(); await expect(page.locator('html')).toHaveClass(/dark/); await page.reload(); await expect(page.locator('html')).toHaveClass(/dark/);
});
test('settings save round-trips', async ({ page }) => {
  await login(page,'super@smart.test'); await page.goto('/settings'); const f = page.getByLabel('Announcement bar (blank hides it)'); await f.fill('DEMO announcement e2e'); await page.getByRole('button',{name:'Save settings'}).click(); await expect(page.getByText(/Settings saved/)).toBeVisible();
  await page.reload(); await expect(page.getByLabel('Announcement bar (blank hides it)')).toHaveValue('DEMO announcement e2e');
  await page.getByLabel('Announcement bar (blank hides it)').fill(''); await page.getByRole('button',{name:'Save settings'}).click(); await expect(page.getByText(/Settings saved/).first()).toBeVisible();
});
test('responsive: no horizontal overflow at 375/768/1024/1440 + screenshots', async ({ browser }) => {
  for (const w of [375,768,1024,1440]) {
    const ctx = await browser.newContext({ viewport:{width:w,height:w<500?812:900} }); const page = await ctx.newPage(); await login(page,'super@smart.test');
    for (const [path,name] of [['/','dashboard'],['/products','products'],['/orders','orders'],['/inventory','inventory'],['/offers','offers'],['/users','users'],['/audit','audit'],['/settings','settings'],['/reports','reports']]) {
      await page.goto(path); await page.waitForLoadState('networkidle'); await page.waitForTimeout(250);
      const over = await page.evaluate(()=>document.documentElement.scrollWidth - window.innerWidth); expect(over, `${path} @${w}`).toBeLessThanOrEqual(1);
      if (['dashboard','products','orders','users'].includes(name) || w===1440) await shot(page,`${name}-${w}-light`);
    }
    if (w===375) { await page.getByRole('button',{name:'Open menu'}).click(); await expect(page.getByRole('navigation',{name:'Main'}).first()).toBeVisible(); await shot(page,'menu-375-light'); }
    if (w===1440) { await page.goto('/'); await page.getByRole('button',{name:'Toggle dark mode'}).click(); await page.waitForTimeout(300); await shot(page,'dashboard-1440-dark'); await page.goto('/products'); await page.getByRole('button',{name:'New product'}).click(); await page.waitForTimeout(300); await shot(page,'product-form-1440-dark'); }
    await ctx.close();
  }
  await (await browser.newContext({viewport:{width:1440,height:900}})).newPage().then(async p=>{ await p.goto('/login'); await shot(p,'login-1440-light'); });
});
