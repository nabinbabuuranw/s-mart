import { Injectable } from '@nestjs/common';
import { bestUnitPrice, OfferLike } from '@smart/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}
  activeOffers(at = new Date()) {
    return this.prisma.offer.findMany({ where: { active: true, startsAt: { lte: at }, endsAt: { gte: at } } });
  }
  /** Decorate products (with variants) with effective prices. Offers never stack; the lowest price wins. */
  async decorate<P extends { id: string; categoryId: string; variants: any[] }>(products: P[], at = new Date()) {
    const offers = (await this.activeOffers(at)) as unknown as (OfferLike & { id: string; title: string })[];
    return products.map((p) => {
      const variants = p.variants.map((v) => {
        const { unitPrice, offer } = bestUnitPrice(v.price, p.id, p.categoryId, offers, at);
        return { id: v.id, sku: v.sku, name: v.name, price: unitPrice, listPrice: v.price, compareAtPrice: v.compareAtPrice ?? null, offer: offer ? { id: (offer as any).id, title: (offer as any).title } : null,
          available: !v.trackInventory || v.stock > 0, lowStock: v.trackInventory && v.stock > 0 && v.stock <= v.lowStockAt };
      });
      const prices = variants.filter((v) => v.available).map((v) => v.price);
      const allPrices = variants.map((v) => v.price);
      return { ...p, variants, priceFrom: Math.min(...(prices.length ? prices : allPrices)), onOffer: variants.some((v) => v.offer) };
    });
  }
}
