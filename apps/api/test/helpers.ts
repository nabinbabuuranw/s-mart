import request from 'supertest';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app.factory';
import { loadEnv } from '../src/config/env';
import { PrismaClient } from '@prisma/client';
import type { NestExpressApplication } from '@nestjs/platform-express';

export const PW = 'Test-Password-12345';
let hashed: string | null = null;
export const prisma = new PrismaClient();

export async function makeApp(over: Record<string, string> = {}): Promise<NestExpressApplication> {
  const env = loadEnv({ ...process.env, JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'x'.repeat(40), ...over } as any);
  const app = await createApp(env); await app.init(); return app;
}
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
export const api = (app: NestExpressApplication) => request(app.getHttpServer());

export async function mkUser(role: string, tag = role) {
  hashed ??= await argon2.hash(PW, { type: argon2.argon2id, memoryCost: 4096, timeCost: 2, parallelism: 1 });
  const r = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  const email = `${tag}-${randomUUID().slice(0, 8)}@t.test`;
  const u = await prisma.user.create({ data: { email, name: `T ${tag}`, passwordHash: hashed, roleId: r.id } });
  return { ...u, email };
}
export type Session = { token: string; refresh: string; user: any; email: string };
export async function login(app: NestExpressApplication, email: string, audience: 'admin' | 'customer', password = PW): Promise<Session> {
  const res = await api(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip()).send({ email, password, audience });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken, refresh: res.body.refreshToken, user: res.body.user, email };
}
export async function staff(app: NestExpressApplication, role = 'admin') { const u = await mkUser(role); const s = await login(app, u.email, 'admin'); return { ...s, id: u.id }; }
export async function customer(app: NestExpressApplication) { const u = await mkUser('customer'); const s = await login(app, u.email, 'customer'); return { ...s, id: u.id }; }
export const auth = (s: { token: string }) => ({ Authorization: `Bearer ${s.token}` });

export async function mkCategory(name = 'Cat') { return prisma.category.create({ data: { name: `${name}-${randomUUID().slice(0, 6)}`, slug: `c-${randomUUID().slice(0, 10)}` } }); }
export async function mkProduct(opts: { price?: number; stock?: number; category?: string; track?: boolean; name?: string } = {}) {
  const cat = opts.category ? { id: opts.category } : await mkCategory();
  const id = randomUUID().slice(0, 8);
  return prisma.product.create({ data: { name: opts.name ?? `Prod ${id}`, slug: `p-${id}`, categoryId: cat.id, variants: { create: [{ sku: `SKU-${id}`, price: opts.price ?? 10000, stock: opts.stock ?? 10, trackInventory: opts.track ?? true }] } }, include: { variants: true } });
}
export async function mkAddress(userId: string) { return prisma.address.create({ data: { userId, fullName: 'Test Person', phone: '9800000000', line1: 'Street 1', city: 'Inaruwa', isDefault: true } }); }
export async function placeOrder(app: NestExpressApplication, c: { token: string; id: string }, variantId: string, qty = 1, extra: Record<string, unknown> = {}) {
  await api(app).post('/api/v1/me/cart/items').set(auth(c)).send({ variantId, quantity: qty });
  const addr = await mkAddress(c.id);
  return api(app).post('/api/v1/checkout').set(auth(c)).set('Idempotency-Key', randomUUID()).send({ addressId: addr.id, paymentMethod: 'cod', ...extra });
}
