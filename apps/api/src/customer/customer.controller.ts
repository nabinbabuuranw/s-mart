import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z as zod } from 'zod';
import { addressSchema, cartAddSchema, cartSetSchema, paginationSchema, profileSchema, ticketCreateSchema, ticketMessageSchema } from '@smart/shared';
import { AuthUser, ClientIp, CurrentUser, CustomerOnly } from '../common/auth';
import { z } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../catalog/pricing.service';
import { AuditService } from '../common/audit';
import { EventsService } from '../common/events';
import { OrdersService } from '../orders/orders.service';
import { productInclude } from '../catalog/catalog.controller';

const page = paginationSchema;

@ApiTags('customer')
@CustomerOnly()
@Controller('me')
export class CustomerController {
  constructor(private prisma: PrismaService, private pricing: PricingService, private audit: AuditService, private events: EventsService, private orders: OrdersService) {}

  // ---- profile
  @Get('profile') async profile(@CurrentUser() u: AuthUser) { const r = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { id: true, email: true, name: true, phone: true, createdAt: true } }); return r; }
  @Patch('profile') async updateProfile(@CurrentUser() u: AuthUser, @Body(z(profileSchema)) d: any, @ClientIp() ip: string) {
    const r = await this.prisma.user.update({ where: { id: u.id }, data: d, select: { id: true, email: true, name: true, phone: true } });
    await this.audit.log(u, 'profile.update', 'user', u.id, undefined, d, ip); return r;
  }

  // ---- cart (server-priced)
  private async cartView(userId: string) {
    const cart = await this.prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
    const items = await this.prisma.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { createdAt: 'asc' }, include: { variant: { include: { product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } } } } } });
    const live = items.filter((i) => i.variant.active && i.variant.product.active && !i.variant.product.deletedAt);
    const offers = await this.orders.offersFor();
    const lines = live.map((i) => {
      const { unitPrice, offer } = this.orders.priceOf(i.variant, i.variant.product, offers);
      return { id: i.id, variantId: i.variantId, productId: i.variant.productId, slug: i.variant.product.slug, name: i.variant.product.name, variantName: i.variant.name, image: i.variant.product.images[0]?.url ?? null, quantity: i.quantity, unitPrice, listPrice: i.variant.price, offerTitle: offer?.title ?? null, lineTotal: unitPrice * i.quantity,
        available: !i.variant.trackInventory || i.variant.stock >= i.quantity, stock: i.variant.trackInventory ? i.variant.stock : null };
    });
    const totals = await this.orders.totalsFor(lines, null);
    return { items: lines, ...totals };
  }
  @Get('cart') cart(@CurrentUser() u: AuthUser) { return this.cartView(u.id); }
  @Post('cart/items') async addToCart(@CurrentUser() u: AuthUser, @Body(z(cartAddSchema)) d: any) {
    const v = await this.prisma.productVariant.findFirst({ where: { id: d.variantId, active: true, product: { active: true, deletedAt: null } } });
    if (!v) throw new NotFoundException({ code: 'not_found', message: 'Variant not found' });
    const cart = await this.prisma.cart.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
    const cur = await this.prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId: v.id } } });
    const qty = Math.min(99, (cur?.quantity ?? 0) + d.quantity);
    if (v.trackInventory && qty > v.stock) throw new BadRequestException({ code: 'insufficient_stock', message: `Only ${v.stock} left in stock` });
    await this.prisma.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId: v.id } }, update: { quantity: qty }, create: { cartId: cart.id, variantId: v.id, quantity: qty } });
    return this.cartView(u.id);
  }
  @Put('cart/items/:variantId') async setCartItem(@CurrentUser() u: AuthUser, @Param('variantId', ParseUUIDPipe) vid: string, @Body(z(cartSetSchema)) d: any) {
    const cart = await this.prisma.cart.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
    if (d.quantity === 0) { await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId: vid } }); return this.cartView(u.id); }
    const v = await this.prisma.productVariant.findFirst({ where: { id: vid, active: true } });
    if (!v) throw new NotFoundException();
    if (v.trackInventory && d.quantity > v.stock) throw new BadRequestException({ code: 'insufficient_stock', message: `Only ${v.stock} left in stock` });
    await this.prisma.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId: vid } }, update: { quantity: d.quantity }, create: { cartId: cart.id, variantId: vid, quantity: d.quantity } });
    return this.cartView(u.id);
  }
  @Delete('cart') async clearCart(@CurrentUser() u: AuthUser) { await this.prisma.cartItem.deleteMany({ where: { cart: { userId: u.id } } }); return this.cartView(u.id); }

  // ---- wishlist
  @Get('wishlist') async wishlist(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.wishlistItem.findMany({ where: { userId: u.id, product: { deletedAt: null } }, orderBy: { createdAt: 'desc' }, include: { product: { include: productInclude } } });
    return (await this.pricing.decorate(rows.map((r) => r.product)));
  }
  @Put('wishlist/:productId') async addWish(@CurrentUser() u: AuthUser, @Param('productId', ParseUUIDPipe) pid: string) {
    const p = await this.prisma.product.findFirst({ where: { id: pid, active: true, deletedAt: null } }); if (!p) throw new NotFoundException();
    await this.prisma.wishlistItem.upsert({ where: { userId_productId: { userId: u.id, productId: pid } }, update: {}, create: { userId: u.id, productId: pid } });
    return { ok: true };
  }
  @Delete('wishlist/:productId') async removeWish(@CurrentUser() u: AuthUser, @Param('productId', ParseUUIDPipe) pid: string) { await this.prisma.wishlistItem.deleteMany({ where: { userId: u.id, productId: pid } }); return { ok: true }; }

  // ---- addresses
  @Get('addresses') addresses(@CurrentUser() u: AuthUser) { return this.prisma.address.findMany({ where: { userId: u.id, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }); }
  @Post('addresses') async addAddress(@CurrentUser() u: AuthUser, @Body(z(addressSchema)) d: any) {
    const count = await this.prisma.address.count({ where: { userId: u.id, deletedAt: null } });
    if (count >= 20) throw new BadRequestException({ code: 'limit', message: 'Address limit reached' });
    return this.prisma.$transaction(async (tx) => { const isDefault = d.isDefault || count === 0; if (isDefault) await tx.address.updateMany({ where: { userId: u.id }, data: { isDefault: false } }); return tx.address.create({ data: { ...d, isDefault, userId: u.id } }); });
  }
  @Put('addresses/:id') async updateAddress(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(z(addressSchema)) d: any) {
    const a = await this.prisma.address.findFirst({ where: { id, userId: u.id, deletedAt: null } }); if (!a) throw new NotFoundException({ code: 'not_found', message: 'Address not found' });
    return this.prisma.$transaction(async (tx) => { if (d.isDefault) await tx.address.updateMany({ where: { userId: u.id }, data: { isDefault: false } }); return tx.address.update({ where: { id }, data: d }); });
  }
  @Delete('addresses/:id') async deleteAddress(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.prisma.address.updateMany({ where: { id, userId: u.id, deletedAt: null }, data: { deletedAt: new Date(), isDefault: false } });
    if (r.count === 0) throw new NotFoundException({ code: 'not_found', message: 'Address not found' }); return { ok: true };
  }

  // ---- notifications
  @Get('notifications') async notifications(@CurrentUser() u: AuthUser, @Query(z(page)) q: any) {
    const where = { userId: u.id };
    const [total, unread, items] = await Promise.all([this.prisma.notification.count({ where }), this.prisma.notification.count({ where: { ...where, readAt: null } }), this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize })]);
    return { items, total, unread, page: q.page, pageSize: q.pageSize };
  }
  @Post('notifications/read-all') async readAll(@CurrentUser() u: AuthUser) { await this.prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } }); return { ok: true }; }
  @Post('notifications/:id/read') async read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { const r = await this.prisma.notification.updateMany({ where: { id, userId: u.id }, data: { readAt: new Date() } }); if (!r.count) throw new NotFoundException(); return { ok: true }; }

  // ---- support tickets
  @Get('tickets') tickets(@CurrentUser() u: AuthUser) { return this.prisma.supportTicket.findMany({ where: { userId: u.id }, orderBy: { updatedAt: 'desc' } }); }
  @Post('tickets') async createTicket(@CurrentUser() u: AuthUser, @Body(z(ticketCreateSchema)) d: any) {
    if (d.orderId && !(await this.prisma.order.findFirst({ where: { id: d.orderId, userId: u.id } }))) throw new NotFoundException({ code: 'not_found', message: 'Order not found' });
    const n = await this.prisma.supportTicket.count();
    const t = await this.prisma.supportTicket.create({ data: { number: `T-${String(10000 + n + 1)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, userId: u.id, subject: d.subject, priority: d.priority, orderId: d.orderId, messages: { create: { authorId: u.id, body: d.body } } } });
    await this.prisma.notification.create({ data: { audience: 'staff', type: 'ticket.created', title: 'New support ticket', body: d.subject, data: { ticketId: t.id } } });
    this.events.staffEvent('ticket.created', { id: t.id, number: t.number, subject: t.subject }, 'tickets.read');
    return t;
  }
  @Get('tickets/:id') async ticket(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const t = await this.prisma.supportTicket.findFirst({ where: { id, userId: u.id }, include: { messages: { where: { internal: false }, orderBy: { createdAt: 'asc' } } } });
    if (!t) throw new NotFoundException({ code: 'not_found', message: 'Ticket not found' }); return t;
  }
  @Post('tickets/:id/messages') async reply(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(z(ticketMessageSchema)) d: any) {
    const t = await this.prisma.supportTicket.findFirst({ where: { id, userId: u.id } }); if (!t) throw new NotFoundException({ code: 'not_found', message: 'Ticket not found' });
    if (t.status === 'closed') throw new BadRequestException({ code: 'ticket_closed', message: 'Ticket is closed' });
    const m = await this.prisma.ticketMessage.create({ data: { ticketId: id, authorId: u.id, body: d.body } });
    await this.prisma.supportTicket.update({ where: { id }, data: { status: 'open' } });
    this.events.staffEvent('ticket.reply', { id, number: t.number }, 'tickets.read');
    return m;
  }
}
