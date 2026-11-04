import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ROLE_DEFINITIONS, SETTING_DEFAULTS } from '../packages/shared/src';

const prisma = new PrismaClient();
const pw = process.env.SEED_DEMO_PASSWORD;
if (!pw || pw.length < 10) { console.error('Set SEED_DEMO_PASSWORD (>= 10 chars) before seeding.'); process.exit(1); }
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'yes') { console.error('Refusing to seed DEMO data in production (set ALLOW_DEMO_SEED=yes to override).'); process.exit(1); }

const PALETTE = ['#1E2B3A', '#D98E04', '#3E5C76', '#7A5518', '#4B5D52', '#8A3B2E', '#5B6370', '#2F4858'];
async function tile(name: string, label: string, i: number) {
  const dir = path.resolve(process.env.UPLOAD_DIR ?? './uploads'); await fs.mkdir(dir, { recursive: true });
  const bg = PALETTE[i % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${label} demo placeholder"><rect width="600" height="600" fill="${bg}"/><rect x="40" y="40" width="520" height="520" fill="none" stroke="#F4F1EA" stroke-opacity=".35"/><text x="300" y="300" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#F4F1EA">${label}</text><text x="300" y="350" text-anchor="middle" font-family="monospace" font-size="18" fill="#F4F1EA" fill-opacity=".7">DEMO PLACEHOLDER</text></svg>`;
  await fs.writeFile(path.join(dir, name), svg);
  return `/api/v1/files/${name}`;
}

const CATS = [
  { slug: 'groceries', name: 'Groceries', description: 'Pantry staples (DEMO catalogue)' },
  { slug: 'home-kitchen', name: 'Home & Kitchen', description: 'Everyday home items (DEMO catalogue)' },
  { slug: 'electronics', name: 'Electronics', description: 'Accessories and small devices (DEMO catalogue)' },
  { slug: 'personal-care', name: 'Personal Care', description: 'Care and hygiene (DEMO catalogue)' },
  { slug: 'stationery', name: 'Stationery', description: 'Paper and desk items (DEMO catalogue)' },
];
const PRODUCTS: [string, string, string, number, number][] = [
  // slug, name, category, price NPR, stock
  ['demo-basmati-rice-5kg', 'DEMO Basmati Rice 5 kg', 'groceries', 1250, 40], ['demo-lentils-1kg', 'DEMO Red Lentils 1 kg', 'groceries', 210, 80], ['demo-tea-leaves-250g', 'DEMO Tea Leaves 250 g', 'groceries', 320, 60],
  ['demo-steel-pot-set', 'DEMO Steel Pot Set (3 pcs)', 'home-kitchen', 3400, 12], ['demo-pressure-cooker-5l', 'DEMO Pressure Cooker 5 L', 'home-kitchen', 4200, 8], ['demo-water-bottle-1l', 'DEMO Water Bottle 1 L', 'home-kitchen', 650, 3],
  ['demo-usb-c-cable', 'DEMO USB-C Cable 1 m', 'electronics', 450, 100], ['demo-earbuds', 'DEMO Wired Earbuds', 'electronics', 900, 25], ['demo-power-bank-10k', 'DEMO Power Bank 10,000 mAh', 'electronics', 2800, 15],
  ['demo-herbal-soap', 'DEMO Herbal Soap 3-pack', 'personal-care', 330, 70], ['demo-shampoo-340ml', 'DEMO Shampoo 340 ml', 'personal-care', 480, 45],
  ['demo-notebook-a5', 'DEMO Notebook A5 (set of 4)', 'stationery', 560, 90], ['demo-gel-pens-10', 'DEMO Gel Pens (10)', 'stationery', 280, 0],
];

async function main() {
  for (const [name, d] of Object.entries(ROLE_DEFINITIONS)) await prisma.role.upsert({ where: { name }, update: { permissions: d.permissions, label: d.label, isStaff: d.isStaff }, create: { name, label: d.label, isStaff: d.isStaff, system: true, permissions: d.permissions } });
  for (const [key, d] of Object.entries(SETTING_DEFAULTS)) await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: d.value as any, isPublic: d.isPublic } });
  await prisma.setting.update({ where: { key: 'supportEmail' }, data: { value: 'support@smart.example' } });
  const hash = await argon2.hash(pw!, { type: argon2.argon2id });
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));
  const users: [string, string, string][] = [
    ['super@smart.test', 'DEMO Super Admin', 'super_admin'], ['admin@smart.test', 'DEMO Admin', 'admin'], ['manager@smart.test', 'DEMO Manager', 'manager'], ['inventory@smart.test', 'DEMO Inventory Staff', 'inventory_staff'],
    ['support@smart.test', 'DEMO Support Agent', 'support_agent'], ['orders@smart.test', 'DEMO Order Staff', 'order_staff'], ['finance@smart.test', 'DEMO Finance', 'finance'],
    ['customer1@smart.test', 'DEMO Customer One', 'customer'], ['customer2@smart.test', 'DEMO Customer Two', 'customer'],
  ];
  for (const [email, name, role] of users) await prisma.user.upsert({ where: { email }, update: { passwordHash: hash, roleId: roles[role], active: true, failedLogins: 0, lockedUntil: null }, create: { email, name, passwordHash: hash, roleId: roles[role] } });
  const cats: Record<string, string> = {};
  for (const [i, c] of CATS.entries()) { const r = await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, sortOrder: i, imageUrl: await tile(`demo-cat-${c.slug}.svg`, c.name, i) } }); cats[c.slug] = r.id; }
  for (const [i, [slug, name, cat, price, stock]] of PRODUCTS.entries()) {
    if (await prisma.product.findUnique({ where: { slug } })) continue;
    const p = await prisma.product.create({ data: { slug, name, description: 'DEMO product for testing S Mart. Not a real item and not for sale.', categoryId: cats[cat], featured: i % 4 === 0, isDemo: true,
      images: { create: [{ url: await tile(`${slug}.svg`, name.replace('DEMO ', ''), i), alt: `${name} placeholder`, sortOrder: 0 }] },
      variants: { create: [{ sku: `DEMO-${String(i + 1).padStart(3, '0')}`, name: 'Default', price: price * 100, stock, lowStockAt: 5 }] } }, include: { variants: true } });
    if (stock > 0) await prisma.stockMovement.create({ data: { variantId: p.variants[0].id, delta: stock, balanceAfter: stock, reason: 'initial', note: 'DEMO seed' } });
  }
  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.createMany({ data: [
      { title: 'Welcome to S Mart (DEMO store)', subtitle: 'Demo banner - managed from the admin dashboard', placement: 'home_hero', sortOrder: 0, imageUrl: await tile('demo-banner-1.svg', 'S Mart', 0) },
      { title: 'Free delivery over Rs. 2,000', subtitle: 'Applies at checkout', placement: 'home_strip', sortOrder: 1 },
    ] });
  }
  if ((await prisma.offer.count()) === 0) await prisma.offer.create({ data: { title: 'DEMO Stationery week - 10% off', type: 'percent', value: 10, startsAt: new Date(Date.now() - 86400000), endsAt: new Date(Date.now() + 30 * 86400000), categoryIds: [cats['stationery']] } });
  if (!(await prisma.coupon.findUnique({ where: { code: 'WELCOME10' } }))) await prisma.coupon.create({ data: { code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 50000 } });
  console.log('Seed complete (DEMO data). Demo logins use SEED_DEMO_PASSWORD from your .env.');
}
main().finally(() => prisma.$disconnect());
