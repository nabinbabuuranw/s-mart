import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z as zod } from 'zod';
import { paginationSchema } from '@smart/shared';
import { Public } from '../common/auth';
import { z } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from './pricing.service';
import { SettingsService } from '../settings/settings.service';

const listQuery = paginationSchema.extend({
  q: zod.string().trim().max(100).optional(),
  category: zod.string().trim().max(120).optional(),
  sort: zod.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
  minPrice: zod.coerce.number().int().min(0).optional(),
  maxPrice: zod.coerce.number().int().min(0).optional(),
  featured: zod.enum(['true', 'false']).optional(),
  onOffer: zod.enum(['true', 'false']).optional(),
});

export const productInclude = { images: { orderBy: { sortOrder: 'asc' as const } }, variants: { where: { active: true }, orderBy: { sortOrder: 'asc' as const } }, category: { select: { id: true, slug: true, name: true } } };

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private prisma: PrismaService, private pricing: PricingService, private settings: SettingsService) {}

  @Public() @Get('config')
  config() { return this.settings.public(); }

  @Public() @Get('categories')
  categories() {
    return this.prisma.category.findMany({ where: { active: true, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, slug: true, name: true, description: true, parentId: true, imageUrl: true, sortOrder: true, _count: { select: { products: { where: { active: true, deletedAt: null } } } } } });
  }

  @Public() @Get('banners')
  banners(@Query('placement') placement?: string) {
    const now = new Date();
    return this.prisma.banner.findMany({ where: { active: true, ...(placement ? { placement } : {}), AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  @Public() @Get('offers')
  async offers() {
    const offers = await this.pricing.activeOffers();
    return offers.map((o) => ({ id: o.id, title: o.title, type: o.type, value: o.value, startsAt: o.startsAt, endsAt: o.endsAt, productIds: o.productIds, categoryIds: o.categoryIds }));
  }

  @Public() @Get('products')
  async list(@Query(z(listQuery)) q: zod.infer<typeof listQuery>) {
    const where: any = { active: true, deletedAt: null, category: { active: true, deletedAt: null } };
    if (q.q) where.OR = [{ name: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }, { brand: { contains: q.q, mode: 'insensitive' } }];
    if (q.category) { const c = await this.prisma.category.findUnique({ where: { slug: q.category }, include: { children: { select: { id: true } } } }); where.categoryId = { in: c ? [c.id, ...c.children.map((x) => x.id)] : ['00000000-0000-0000-0000-000000000000'] }; }
    if (q.featured === 'true') where.featured = true;
    if (q.minPrice !== undefined || q.maxPrice !== undefined) where.variants = { some: { active: true, price: { gte: q.minPrice ?? 0, lte: q.maxPrice ?? 2_000_000_000 } } };
    const orderBy: any = q.sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' };
    // price sorts + onOffer need decorated prices, so sort in memory over the filtered set (catalogue sizes here are small; documented limit).
    const needMem = q.sort === 'price_asc' || q.sort === 'price_desc' || q.onOffer === 'true';
    if (!needMem) {
      const [total, rows] = await Promise.all([this.prisma.product.count({ where }), this.prisma.product.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: productInclude })]);
      return { items: await this.pricing.decorate(rows), total, page: q.page, pageSize: q.pageSize };
    }
    const all = await this.pricing.decorate(await this.prisma.product.findMany({ where, include: productInclude, take: 2000 }));
    let items = q.onOffer === 'true' ? all.filter((p) => p.onOffer) : all;
    if (q.sort === 'price_asc') items = items.sort((a, b) => a.priceFrom - b.priceFrom);
    if (q.sort === 'price_desc') items = items.sort((a, b) => b.priceFrom - a.priceFrom);
    return { items: items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: items.length, page: q.page, pageSize: q.pageSize };
  }

  @Public() @Get('products/:slug')
  async one(@Param('slug') slug: string) {
    const p = await this.prisma.product.findFirst({ where: { slug, active: true, deletedAt: null }, include: productInclude });
    if (!p) throw new NotFoundException({ code: 'not_found', message: 'Product not found' });
    return (await this.pricing.decorate([p]))[0];
  }
}
