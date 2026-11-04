import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z as zod } from 'zod';
import { bannerSchema, categorySchema, couponSchema, offerSchema, paginationSchema, productSchema, productUpdateSchema, stockAdjustSchema } from '@smart/shared';
import { AuthUser, ClientIp, CurrentUser, Perms } from '../common/auth';
import { z } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { EventsService } from '../common/events';
import { PricingService } from './pricing.service';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'item';
const adminList = paginationSchema.extend({ q: zod.string().trim().max(100).optional(), active: zod.enum(['true', 'false']).optional(), lowStock: zod.enum(['true']).optional(), categoryId: zod.string().uuid().optional() });

@ApiTags('admin-catalog')
@Controller('admin')
export class AdminCatalogController {
  constructor(private prisma: PrismaService, private audit: AuditService, private events: EventsService, private pricing: PricingService) {}

  private async uniqueSlug(model: 'product' | 'category', base: string, exceptId?: string) {
    let slug = slugify(base); let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await (this.prisma[model] as any).findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } })) slug = `${slugify(base)}-${++n}`;
    return slug;
  }

  // ---- categories
  @Perms('products.read') @Get('categories')
  categories() { return this.prisma.category.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: { deletedAt: null } } } } } }); }

  @Perms('categories.write') @Post('categories')
  async createCategory(@Body(z(categorySchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    if (d.parentId) { const p = await this.prisma.category.findFirst({ where: { id: d.parentId, deletedAt: null } }); if (!p) throw new BadRequestException({ code: 'bad_parent', message: 'Parent category not found' }); }
    const c = await this.prisma.category.create({ data: { ...d, slug: d.slug ? await this.uniqueSlug('category', d.slug) : await this.uniqueSlug('category', d.name) } });
    await this.audit.log(u, 'category.create', 'category', c.id, undefined, c, ip); this.events.publicEvent('category.changed', { id: c.id });
    return c;
  }
  @Perms('categories.write') @Patch('categories/:id')
  async updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body(z(categorySchema.partial().strict())) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.category.findFirst({ where: { id, deletedAt: null } }); if (!before) throw new NotFoundException();
    if (d.parentId === id) throw new BadRequestException({ code: 'bad_parent', message: 'A category cannot be its own parent' });
    const c = await this.prisma.category.update({ where: { id }, data: d });
    await this.audit.log(u, 'category.update', 'category', id, before, c, ip); this.events.publicEvent('category.changed', { id });
    return c;
  }
  @Perms('categories.write') @Delete('categories/:id')
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const n = await this.prisma.product.count({ where: { categoryId: id, deletedAt: null } });
    if (n > 0) throw new BadRequestException({ code: 'category_not_empty', message: 'Move or delete the products in this category first' });
    const before = await this.prisma.category.findFirst({ where: { id, deletedAt: null } }); if (!before) throw new NotFoundException();
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit.log(u, 'category.delete', 'category', id, before, undefined, ip); this.events.publicEvent('category.changed', { id });
    return { ok: true };
  }

  // ---- products
  @Perms('products.read') @Get('products')
  async products(@Query(z(adminList)) q: zod.infer<typeof adminList>) {
    const where: any = { deletedAt: null };
    if (q.q) where.OR = [{ name: { contains: q.q, mode: 'insensitive' } }, { variants: { some: { sku: { contains: q.q, mode: 'insensitive' } } } }];
    if (q.active) where.active = q.active === 'true';
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.lowStock) where.variants = { some: { trackInventory: true, stock: { lte: 5 } } };
    const [total, items] = await Promise.all([this.prisma.product.count({ where }), this.prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { variants: { orderBy: { sortOrder: 'asc' } }, images: { orderBy: { sortOrder: 'asc' } }, category: { select: { id: true, name: true } } } })]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @Perms('products.read') @Get('products/:id')
  async product(@Param('id', ParseUUIDPipe) id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, deletedAt: null }, include: { variants: { orderBy: { sortOrder: 'asc' } }, images: { orderBy: { sortOrder: 'asc' } }, category: true } });
    if (!p) throw new NotFoundException(); return p;
  }

  @Perms('products.write') @Post('products')
  async createProduct(@Body(z(productSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const cat = await this.prisma.category.findFirst({ where: { id: d.categoryId, deletedAt: null } }); if (!cat) throw new BadRequestException({ code: 'bad_category', message: 'Category not found' });
    const slug = await this.uniqueSlug('product', d.slug ?? d.name);
    const p = await this.prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({ data: { name: d.name, slug, description: d.description, brand: d.brand ?? null, categoryId: d.categoryId, active: d.active, featured: d.featured,
        variants: { create: d.variants.map((v: any, i: number) => ({ sku: v.sku, name: v.name, price: v.price, compareAtPrice: v.compareAtPrice ?? null, stock: v.stock, trackInventory: v.trackInventory, lowStockAt: v.lowStockAt, active: v.active, sortOrder: i })) },
        images: { create: (d.images ?? []).map((im: any, i: number) => ({ url: im.url, alt: im.alt, sortOrder: i })) } }, include: { variants: true, images: true } });
      for (const v of prod.variants) if (v.stock > 0) await tx.stockMovement.create({ data: { variantId: v.id, delta: v.stock, balanceAfter: v.stock, reason: 'initial', actorId: u.id } });
      await this.audit.log(u, 'product.create', 'product', prod.id, undefined, prod, ip, tx);
      return prod;
    });
    this.events.publicEvent('product.created', { id: p.id, slug: p.slug });
    return p;
  }

  @Perms('products.write') @Patch('products/:id')
  async updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body(z(productUpdateSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.product.findFirst({ where: { id, deletedAt: null }, include: { variants: true, images: true } }); if (!before) throw new NotFoundException();
    if (d.categoryId && !(await this.prisma.category.findFirst({ where: { id: d.categoryId, deletedAt: null } }))) throw new BadRequestException({ code: 'bad_category', message: 'Category not found' });
    const after = await this.prisma.$transaction(async (tx) => {
      const { variants, images, slug, ...scalar } = d;
      await tx.product.update({ where: { id }, data: { ...scalar, ...(slug ? { slug: await this.uniqueSlug('product', slug, id) } : {}) } });
      if (variants) {
        const keep = new Set<string>();
        for (const [i, v] of (variants as any[]).entries()) {
          const existing = v.id ? before.variants.find((x) => x.id === v.id) : undefined;
          if (v.id && !existing) throw new BadRequestException({ code: 'bad_variant', message: 'Variant does not belong to this product' });
          const data = { sku: v.sku, name: v.name, price: v.price, compareAtPrice: v.compareAtPrice ?? null, trackInventory: v.trackInventory, lowStockAt: v.lowStockAt, active: v.active, sortOrder: i };
          if (existing) {
            keep.add(existing.id);
            await tx.productVariant.update({ where: { id: existing.id }, data });
            if (v.stock !== existing.stock) { await tx.productVariant.update({ where: { id: existing.id }, data: { stock: v.stock } }); await tx.stockMovement.create({ data: { variantId: existing.id, delta: v.stock - existing.stock, balanceAfter: v.stock, reason: 'adjustment', actorId: u.id, note: 'product edit' } }); }
          } else {
            const nv = await tx.productVariant.create({ data: { ...data, stock: v.stock, productId: id } }); keep.add(nv.id);
            if (v.stock > 0) await tx.stockMovement.create({ data: { variantId: nv.id, delta: v.stock, balanceAfter: v.stock, reason: 'initial', actorId: u.id } });
          }
        }
        for (const old of before.variants) if (!keep.has(old.id)) {
          const used = await tx.orderItem.count({ where: { variantId: old.id } });
          if (used > 0) await tx.productVariant.update({ where: { id: old.id }, data: { active: false } }); else { await tx.cartItem.deleteMany({ where: { variantId: old.id } }); await tx.stockMovement.deleteMany({ where: { variantId: old.id } }); await tx.productVariant.delete({ where: { id: old.id } }); }
        }
      }
      if (images) { await tx.productImage.deleteMany({ where: { productId: id } }); await tx.productImage.createMany({ data: (images as any[]).map((im, i) => ({ productId: id, url: im.url, alt: im.alt, sortOrder: i })) }); }
      const res = await tx.product.findUniqueOrThrow({ where: { id }, include: { variants: true, images: true } });
      await this.audit.log(u, 'product.update', 'product', id, before, res, ip, tx);
      return res;
    });
    this.events.publicEvent('product.updated', { id, slug: after.slug, priceChanged: !!d.variants });
    return after;
  }

  @Perms('products.write') @Delete('products/:id')
  async deleteProduct(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.product.findFirst({ where: { id, deletedAt: null } }); if (!before) throw new NotFoundException();
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit.log(u, 'product.delete', 'product', id, before, undefined, ip); this.events.publicEvent('product.deleted', { id, slug: before.slug });
    return { ok: true };
  }

  // ---- inventory
  @Perms('inventory.read') @Get('inventory')
  async inventory(@Query(z(adminList)) q: zod.infer<typeof adminList>) {
    const where: any = { product: { deletedAt: null }, ...(q.q ? { OR: [{ sku: { contains: q.q, mode: 'insensitive' } }, { product: { name: { contains: q.q, mode: 'insensitive' } } }] } : {}) };
    const rows = await this.prisma.productVariant.findMany({ where, orderBy: [{ stock: 'asc' }], include: { product: { select: { id: true, name: true, slug: true } } }, take: 500 });
    const items = rows.map((v) => ({ id: v.id, sku: v.sku, name: v.name, productId: v.product.id, productName: v.product.name, stock: v.stock, lowStockAt: v.lowStockAt, trackInventory: v.trackInventory, low: v.trackInventory && v.stock <= v.lowStockAt }));
    const filtered = q.lowStock ? items.filter((i) => i.low) : items;
    return { items: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: filtered.length, page: q.page, pageSize: q.pageSize };
  }
  @Perms('inventory.read') @Get('inventory/:variantId/ledger')
  ledger(@Param('variantId', ParseUUIDPipe) id: string) { return this.prisma.stockMovement.findMany({ where: { variantId: id }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Perms('inventory.write') @Post('inventory/:variantId/adjust')
  async adjust(@Param('variantId', ParseUUIDPipe) id: string, @Body(z(stockAdjustSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const res = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ stock: number }[]>`UPDATE "ProductVariant" SET stock = stock + ${d.delta}, "updatedAt" = now() WHERE id = ${id} AND stock + ${d.delta} >= 0 RETURNING stock`;
      if (rows.length === 0) { const exists = await tx.productVariant.findUnique({ where: { id } }); if (!exists) throw new NotFoundException(); throw new BadRequestException({ code: 'negative_stock', message: 'Adjustment would make stock negative' }); }
      const m = await tx.stockMovement.create({ data: { variantId: id, delta: d.delta, balanceAfter: rows[0].stock, reason: 'adjustment', note: d.note, actorId: u.id } });
      await this.audit.log(u, 'inventory.adjust', 'variant', id, undefined, { delta: d.delta, balanceAfter: rows[0].stock, note: d.note }, ip, tx);
      return m;
    });
    this.events.publicEvent('inventory.changed', { variantId: id });
    return res;
  }

  // ---- offers / coupons / banners
  @Perms('pricing.write') @Get('offers') offers() { return this.prisma.offer.findMany({ orderBy: { createdAt: 'desc' } }); }
  @Perms('pricing.write') @Post('offers')
  async createOffer(@Body(z(offerSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const o = await this.prisma.offer.create({ data: d }); await this.audit.log(u, 'offer.create', 'offer', o.id, undefined, o, ip); this.events.publicEvent('offer.changed', { id: o.id }); return o; }
  @Perms('pricing.write') @Put('offers/:id')
  async updateOffer(@Param('id', ParseUUIDPipe) id: string, @Body(z(offerSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const b = await this.prisma.offer.findUnique({ where: { id } }); if (!b) throw new NotFoundException(); const o = await this.prisma.offer.update({ where: { id }, data: d }); await this.audit.log(u, 'offer.update', 'offer', id, b, o, ip); this.events.publicEvent('offer.changed', { id }); return o; }
  @Perms('pricing.write') @Delete('offers/:id')
  async deleteOffer(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const b = await this.prisma.offer.findUnique({ where: { id } }); if (!b) throw new NotFoundException(); await this.prisma.offer.delete({ where: { id } }); await this.audit.log(u, 'offer.delete', 'offer', id, b, undefined, ip); this.events.publicEvent('offer.changed', { id }); return { ok: true }; }

  @Perms('pricing.write') @Get('coupons') coupons() { return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }); }
  @Perms('pricing.write') @Post('coupons')
  async createCoupon(@Body(z(couponSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const c = await this.prisma.coupon.create({ data: d }); await this.audit.log(u, 'coupon.create', 'coupon', c.id, undefined, c, ip); return c; }
  @Perms('pricing.write') @Put('coupons/:id')
  async updateCoupon(@Param('id', ParseUUIDPipe) id: string, @Body(z(couponSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const b = await this.prisma.coupon.findUnique({ where: { id } }); if (!b) throw new NotFoundException(); const c = await this.prisma.coupon.update({ where: { id }, data: d }); await this.audit.log(u, 'coupon.update', 'coupon', id, b, c, ip); return c; }
  @Perms('pricing.write') @Delete('coupons/:id')
  async deleteCoupon(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const b = await this.prisma.coupon.findUnique({ where: { id } }); if (!b) throw new NotFoundException(); await this.prisma.coupon.update({ where: { id }, data: { active: false } }); await this.audit.log(u, 'coupon.deactivate', 'coupon', id, b, undefined, ip); return { ok: true }; }

  @Perms('banners.write') @Get('banners') banners() { return this.prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] }); }
  @Perms('banners.write') @Post('banners')
  async createBanner(@Body(z(bannerSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const b = await this.prisma.banner.create({ data: d }); await this.audit.log(u, 'banner.create', 'banner', b.id, undefined, b, ip); this.events.publicEvent('banner.changed', { id: b.id }); return b; }
  @Perms('banners.write') @Put('banners/:id')
  async updateBanner(@Param('id', ParseUUIDPipe) id: string, @Body(z(bannerSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const b = await this.prisma.banner.findUnique({ where: { id } }); if (!b) throw new NotFoundException(); const n = await this.prisma.banner.update({ where: { id }, data: d }); await this.audit.log(u, 'banner.update', 'banner', id, b, n, ip); this.events.publicEvent('banner.changed', { id }); return n; }
  @Perms('banners.write') @Delete('banners/:id')
  async deleteBanner(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { const b = await this.prisma.banner.findUnique({ where: { id } }); if (!b) throw new NotFoundException(); await this.prisma.banner.delete({ where: { id } }); await this.audit.log(u, 'banner.delete', 'banner', id, b, undefined, ip); this.events.publicEvent('banner.changed', { id }); return { ok: true }; }
}
