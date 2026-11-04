import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { bestUnitPrice, canTransition, computeTotals, customerCanCancel, OfferLike, OrderStatusT, withinReturnWindow } from '@smart/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { PricingService } from '../catalog/pricing.service';
import { EventsService } from '../common/events';
import { AuditService } from '../common/audit';
import { PaymentsService } from '../payments/payments.service';
import type { AuthUser } from '../common/auth';

type Tx = Prisma.TransactionClient;
const STATUS_LABEL: Record<string, string> = { placed: 'placed', confirmed: 'confirmed', packed: 'packed', shipped: 'shipped', out_for_delivery: 'out for delivery', delivered: 'delivered', cancelled: 'cancelled', return_requested: 'return requested', returned: 'returned', refunded: 'refunded' };

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private pricing: PricingService, private events: EventsService, private audit: AuditService, private payments: PaymentsService) {}

  offersFor() { return this.pricing.activeOffers() as unknown as Promise<(OfferLike & { id: string; title: string })[]>; }
  priceOf(variant: { price: number }, product: { id: string; categoryId: string }, offers: (OfferLike & { id: string; title: string })[]) {
    const r = bestUnitPrice(variant.price, product.id, product.categoryId, offers, new Date());
    return { unitPrice: r.unitPrice, offer: r.offer as any };
  }
  async totalsFor(lines: { unitPrice: number; listPrice: number; quantity: number }[], coupon: { type: 'percent' | 'fixed'; value: number; minSubtotal: number } | null) {
    const s = await this.settings.all();
    return computeTotals({ lines, coupon, shippingFlat: Number(s.shippingFlat ?? 0), freeShippingOver: s.freeShippingOver === null || s.freeShippingOver === '' ? null : Number(s.freeShippingOver), taxBps: Number(s.taxBps ?? 0) });
  }

  private async nextNumber(tx: Tx) {
    const r = await tx.$queryRaw<{ value: number }[]>`INSERT INTO "OrderCounter" (id, value) VALUES (1, 1001) ON CONFLICT (id) DO UPDATE SET value = "OrderCounter".value + 1 RETURNING value`;
    return `SM-${r[0].value}`;
  }

  async notifyUser(userId: string, orderNumber: string, orderId: string, status: string, tx?: Tx) {
    const client: any = tx ?? this.prisma;
    await client.notification.create({ data: { userId, audience: 'user', type: 'order.status', title: `Order ${orderNumber} ${STATUS_LABEL[status] ?? status}`, body: `Your order ${orderNumber} is now ${STATUS_LABEL[status] ?? status}.`, data: { orderId, status } } });
  }

  async checkout(user: AuthUser, dto: { addressId: string; paymentMethod: string; couponCode?: string; note?: string }, idemKey: string) {
    if (!idemKey || idemKey.length < 8 || idemKey.length > 80 || !/^[A-Za-z0-9._:-]+$/.test(idemKey)) throw new BadRequestException({ code: 'idempotency_key_required', message: 'Send an Idempotency-Key header (8-80 chars)' });
    const prior = await this.prisma.order.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: idemKey } }, include: { items: true } });
    if (prior) return { ...prior, idempotentReplay: true };
    const provider = this.payments.provider(dto.paymentMethod);
    if (!provider.isConfigured()) throw new BadRequestException({ code: 'payment_method_unavailable', message: `${provider.label} is not enabled for this store yet` });
    const settings = await this.settings.all();
    if (dto.paymentMethod === 'cod' && settings.codEnabled === false) throw new BadRequestException({ code: 'payment_method_unavailable', message: 'Cash on delivery is currently disabled' });
    if (settings.maintenanceMode === true) throw new BadRequestException({ code: 'maintenance', message: 'The store is temporarily not taking orders' });
    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId: user.id, deletedAt: null } });
    if (!address) throw new NotFoundException({ code: 'not_found', message: 'Address not found' });
    const cart = await this.prisma.cart.findUnique({ where: { userId: user.id }, include: { items: { include: { variant: { include: { product: true } } } } } });
    const items = (cart?.items ?? []).filter((i) => i.variant.active && i.variant.product.active && !i.variant.product.deletedAt);
    if (items.length === 0) throw new BadRequestException({ code: 'cart_empty', message: 'Your cart is empty' });
    const offers = await this.offersFor();
    const priced = items.map((i) => { const p = this.priceOf(i.variant, i.variant.product, offers); return { i, unitPrice: p.unitPrice, listPrice: i.variant.price }; });
    let coupon: any = null;
    if (dto.couponCode) {
      coupon = await this.prisma.coupon.findUnique({ where: { code: dto.couponCode } });
      const now = new Date();
      if (!coupon || !coupon.active || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now) || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)) throw new BadRequestException({ code: 'invalid_coupon', message: 'Coupon is not valid' });
      const sub = priced.reduce((a, p) => a + p.unitPrice * p.i.quantity, 0);
      if (sub < coupon.minSubtotal) throw new BadRequestException({ code: 'coupon_min_subtotal', message: 'Order total is below the coupon minimum' });
    }
    const totals = await this.totalsFor(priced.map((p) => ({ unitPrice: p.unitPrice, listPrice: p.listPrice, quantity: p.i.quantity })), coupon);
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const sorted = [...priced].sort((a, b) => (a.i.variantId < b.i.variantId ? -1 : 1));
        const moves: { variantId: string; delta: number; balanceAfter: number }[] = [];
        for (const p of sorted) {
          if (!p.i.variant.trackInventory) continue;
          // Atomic conditional decrement: concurrent checkouts can never oversell.
          const r = await tx.$queryRaw<{ stock: number }[]>`UPDATE "ProductVariant" SET stock = stock - ${p.i.quantity}, "updatedAt" = now() WHERE id = ${p.i.variantId} AND stock >= ${p.i.quantity} RETURNING stock`;
          if (r.length === 0) throw new ConflictException({ code: 'out_of_stock', message: `${p.i.variant.product.name} (${p.i.variant.name}) is out of stock or has fewer units than requested` });
          moves.push({ variantId: p.i.variantId, delta: -p.i.quantity, balanceAfter: r[0].stock });
        }
        if (coupon) {
          const upd = coupon.maxUses === null ? await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } }).then(() => 1) : await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE id = ${coupon.id} AND "usedCount" < ${coupon.maxUses}`;
          if (!upd) throw new BadRequestException({ code: 'invalid_coupon', message: 'Coupon usage limit reached' });
        }
        const number = await this.nextNumber(tx);
        const o = await tx.order.create({ data: {
          number, userId: user.id, status: 'placed', paymentStatus: 'unpaid', paymentMethod: dto.paymentMethod as any, subtotal: totals.subtotal, discountTotal: totals.discountTotal, couponCode: coupon?.code ?? null, couponDiscount: totals.couponDiscount, shippingFee: totals.shippingFee, taxTotal: totals.taxTotal, total: totals.total,
          addressSnapshot: { fullName: address.fullName, phone: address.phone, line1: address.line1, line2: address.line2, city: address.city, district: address.district, province: address.province, postalCode: address.postalCode }, note: dto.note, idempotencyKey: idemKey,
          items: { create: priced.map((p) => ({ variantId: p.i.variantId, productId: p.i.variant.productId, name: p.i.variant.product.name, variantName: p.i.variant.name, sku: p.i.variant.sku, unitPrice: p.unitPrice, listPrice: p.listPrice, quantity: p.i.quantity, lineTotal: p.unitPrice * p.i.quantity })) },
          events: { create: { status: 'placed', note: 'Order placed', actorId: user.id } },
          payments: { create: { provider: dto.paymentMethod as any, amount: totals.total, status: 'pending' } } }, include: { items: true } });
        if (coupon) await tx.couponRedemption.create({ data: { couponId: coupon.id, userId: user.id, orderId: o.id } });
        for (const m of moves) await tx.stockMovement.create({ data: { ...m, reason: 'sale', refType: 'order', refId: o.id, actorId: user.id } });
        await tx.cartItem.deleteMany({ where: { cartId: cart!.id } });
        await tx.notification.create({ data: { userId: user.id, audience: 'user', type: 'order.status', title: `Order ${number} placed`, body: `Thanks! We received your order ${number}.`, data: { orderId: o.id, status: 'placed' } } });
        await tx.notification.create({ data: { audience: 'staff', type: 'order.created', title: `New order ${number}`, body: `${user.name} placed an order`, data: { orderId: o.id, number, total: totals.total } } });
        await this.audit.log(user, 'order.place', 'order', o.id, undefined, { number, total: totals.total }, null, tx);
        return o;
      }, { timeout: 15000 });
      this.events.userEvent(user.id, 'order.updated', { orderId: order.id, number: order.number, status: order.status });
      this.events.staffEvent('order.created', { orderId: order.id, number: order.number, total: order.total, customer: user.name });
      this.events.publicEvent('inventory.changed', {});
      return order;
    } catch (e: any) {
      if (e?.code === 'P2002' && String(e.meta?.target).includes('idempotencyKey')) {
        const again = await this.prisma.order.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: idemKey } }, include: { items: true } });
        if (again) return { ...again, idempotentReplay: true };
      }
      throw e;
    }
  }

  orderInclude = { items: true, events: { orderBy: { createdAt: 'asc' as const } }, payments: true, shipments: true, returns: { include: { items: true } }, refunds: true };

  async mine(userId: string, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, userId }, include: this.orderInclude });
    if (!o) throw new NotFoundException({ code: 'not_found', message: 'Order not found' });
    return o;
  }

  private async restock(tx: Tx, order: { id: string; items: { variantId: string; quantity: number }[] }, reason: 'cancel_restock' | 'return_restock', actorId: string | null, only?: { variantId: string; quantity: number }[]) {
    for (const it of only ?? order.items) {
      const v = await tx.productVariant.findUnique({ where: { id: it.variantId } });
      if (!v || !v.trackInventory) continue;
      const r = await tx.$queryRaw<{ stock: number }[]>`UPDATE "ProductVariant" SET stock = stock + ${it.quantity}, "updatedAt" = now() WHERE id = ${it.variantId} RETURNING stock`;
      await tx.stockMovement.create({ data: { variantId: it.variantId, delta: it.quantity, balanceAfter: r[0].stock, reason, refType: 'order', refId: order.id, actorId } });
    }
  }

  async cancel(orderId: string, actor: AuthUser, asCustomer: boolean, reason?: string, ip?: string | null) {
    const res = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.findFirst({ where: { id: orderId, ...(asCustomer ? { userId: actor.id } : {}) }, include: { items: true } });
      if (!o) throw new NotFoundException({ code: 'not_found', message: 'Order not found' });
      if (asCustomer ? !customerCanCancel(o.status as OrderStatusT) : !canTransition(o.status as OrderStatusT, 'cancelled')) throw new BadRequestException({ code: 'not_cancellable', message: `Orders that are ${o.status.replace('_', ' ')} cannot be cancelled` });
      const claimed = await tx.order.updateMany({ where: { id: o.id, status: o.status }, data: { status: 'cancelled', cancelledAt: new Date() } });
      if (claimed.count === 0) throw new ConflictException({ code: 'state_changed', message: 'Order changed, reload and retry' });
      await this.restock(tx, o, 'cancel_restock', actor.id);
      if (o.couponCode) { await tx.coupon.updateMany({ where: { code: o.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } }); await tx.couponRedemption.deleteMany({ where: { orderId: o.id } }); }
      await tx.payment.updateMany({ where: { orderId: o.id, status: 'pending' }, data: { status: 'failed' } });
      await tx.orderEvent.create({ data: { orderId: o.id, status: 'cancelled', note: reason ?? (asCustomer ? 'Cancelled by customer' : 'Cancelled by staff'), actorId: actor.id } });
      await this.notifyUser(o.userId, o.number, o.id, 'cancelled', tx);
      await this.audit.log(actor, asCustomer ? 'order.cancel_customer' : 'order.cancel_staff', 'order', o.id, { status: o.status }, { status: 'cancelled', reason }, ip, tx);
      return o;
    });
    this.events.userEvent(res.userId, 'order.updated', { orderId: res.id, number: res.number, status: 'cancelled' });
    this.events.staffEvent('order.updated', { orderId: res.id, number: res.number, status: 'cancelled' });
    this.events.publicEvent('inventory.changed', {});
    return this.prisma.order.findUnique({ where: { id: res.id }, include: this.orderInclude });
  }

  async setStatus(orderId: string, to: OrderStatusT, actor: AuthUser, note?: string, extra?: { carrier?: string; trackingNumber?: string }, ip?: string | null) {
    if (to === 'cancelled') return this.cancel(orderId, actor, false, note, ip);
    const res = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { id: orderId } });
      if (!o) throw new NotFoundException({ code: 'not_found', message: 'Order not found' });
      if (!canTransition(o.status as OrderStatusT, to)) throw new BadRequestException({ code: 'invalid_transition', message: `Cannot move an order from ${o.status} to ${to}` });
      const claimed = await tx.order.updateMany({ where: { id: o.id, status: o.status }, data: { status: to, ...(to === 'delivered' ? { deliveredAt: new Date() } : {}) } });
      if (claimed.count === 0) throw new ConflictException({ code: 'state_changed', message: 'Order changed, reload and retry' });
      if (to === 'shipped') await tx.shipment.create({ data: { orderId: o.id, carrier: extra?.carrier ?? 'Courier', trackingNumber: extra?.trackingNumber } });
      if (to === 'delivered') {
        await tx.shipment.updateMany({ where: { orderId: o.id, deliveredAt: null }, data: { status: 'delivered', deliveredAt: new Date() } });
        // Cash on delivery counts as paid only now, after delivery is recorded server-side by staff.
        if (o.paymentMethod === 'cod') { await tx.payment.updateMany({ where: { orderId: o.id, status: 'pending' }, data: { status: 'paid', verifiedAt: new Date() } }); await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'paid' } }); }
      }
      await tx.orderEvent.create({ data: { orderId: o.id, status: to, note, actorId: actor.id } });
      await this.notifyUser(o.userId, o.number, o.id, to, tx);
      await this.audit.log(actor, 'order.status', 'order', o.id, { status: o.status }, { status: to, note, ...extra }, ip, tx);
      return o;
    });
    this.events.userEvent(res.userId, 'order.updated', { orderId: res.id, number: res.number, status: to });
    this.events.staffEvent('order.updated', { orderId: res.id, number: res.number, status: to });
    return this.prisma.order.findUnique({ where: { id: res.id }, include: this.orderInclude });
  }

  async requestReturn(user: AuthUser, orderId: string, dto: { reason: string; items: { orderItemId: string; quantity: number }[] }) {
    const days = Number(await this.settings.get('returnWindowDays')) || 7;
    const created = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.findFirst({ where: { id: orderId, userId: user.id }, include: { items: true, returns: { include: { items: true } } } });
      if (!o) throw new NotFoundException({ code: 'not_found', message: 'Order not found' });
      if (o.status !== 'delivered') throw new BadRequestException({ code: 'not_returnable', message: 'Only delivered orders can be returned' });
      if (!withinReturnWindow(o.deliveredAt, days)) throw new BadRequestException({ code: 'return_window_closed', message: `The ${days}-day return window has closed` });
      for (const it of dto.items) {
        const oi = o.items.find((x) => x.id === it.orderItemId);
        if (!oi) throw new BadRequestException({ code: 'bad_item', message: 'Item is not part of this order' });
        const already = o.returns.filter((r) => r.status !== 'rejected').flatMap((r) => r.items).filter((x) => x.orderItemId === oi.id).reduce((a, x) => a + x.quantity, 0);
        if (it.quantity + already > oi.quantity) throw new BadRequestException({ code: 'bad_quantity', message: 'Return quantity exceeds what was purchased' });
      }
      const claimed = await tx.order.updateMany({ where: { id: o.id, status: 'delivered' }, data: { status: 'return_requested' } });
      if (claimed.count === 0) throw new ConflictException({ code: 'state_changed', message: 'Order changed, reload and retry' });
      const r = await tx.returnRequest.create({ data: { orderId: o.id, userId: user.id, reason: dto.reason, items: { create: dto.items } }, include: { items: true } });
      await tx.orderEvent.create({ data: { orderId: o.id, status: 'return_requested', note: dto.reason.slice(0, 200), actorId: user.id } });
      await tx.notification.create({ data: { audience: 'staff', type: 'return.requested', title: `Return requested for ${o.number}`, body: dto.reason.slice(0, 120), data: { orderId: o.id, returnId: r.id } } });
      await this.audit.log(user, 'return.request', 'order', o.id, undefined, { returnId: r.id }, null, tx);
      return { r, o };
    });
    this.events.staffEvent('return.requested', { orderId: created.o.id, number: created.o.number, returnId: created.r.id }, 'returns.manage');
    this.events.userEvent(user.id, 'order.updated', { orderId: created.o.id, number: created.o.number, status: 'return_requested' });
    return created.r;
  }

  async decideReturn(returnId: string, decision: 'approve' | 'reject' | 'received', adminNote: string | undefined, actor: AuthUser, ip?: string | null) {
    const out = await this.prisma.$transaction(async (tx) => {
      const r = await tx.returnRequest.findUnique({ where: { id: returnId }, include: { order: true } });
      if (!r) throw new NotFoundException();
      const allowed: Record<string, string[]> = { approve: ['requested'], reject: ['requested', 'approved'], received: ['approved'] };
      if (!allowed[decision].includes(r.status)) throw new BadRequestException({ code: 'invalid_transition', message: `A ${r.status} return cannot be ${decision === 'received' ? 'marked received' : decision + 'd'}` });
      const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'received';
      await tx.returnRequest.update({ where: { id: r.id }, data: { status, adminNote } });
      if (decision === 'reject') { await tx.order.update({ where: { id: r.orderId }, data: { status: 'delivered' } }); await tx.orderEvent.create({ data: { orderId: r.orderId, status: 'delivered', note: 'Return rejected', actorId: actor.id } }); }
      if (decision === 'received') { await tx.order.update({ where: { id: r.orderId }, data: { status: 'returned' } }); await tx.orderEvent.create({ data: { orderId: r.orderId, status: 'returned', note: 'Return received', actorId: actor.id } }); }
      await this.notifyUser(r.userId, r.order.number, r.orderId, decision === 'reject' ? 'delivered' : decision === 'received' ? 'returned' : 'return_requested', tx);
      await this.audit.log(actor, `return.${decision}`, 'return', r.id, { status: r.status }, { status, adminNote }, ip, tx);
      return r;
    });
    this.events.userEvent(out.userId, 'order.updated', { orderId: out.orderId, number: out.order.number });
    this.events.staffEvent('order.updated', { orderId: out.orderId, number: out.order.number });
    return this.prisma.returnRequest.findUnique({ where: { id: returnId }, include: { items: true } });
  }

  async refund(orderId: string, dto: { amount: number; reason: string; restock: boolean; returnId?: string }, actor: AuthUser, ip?: string | null) {
    const res = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      if (rows.length === 0) throw new NotFoundException({ code: 'not_found', message: 'Order not found' });
      const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payments: true } });
      const paid = o.payments.find((p) => p.status === 'paid' || p.status === 'partially_refunded');
      if (!paid) throw new BadRequestException({ code: 'not_paid', message: 'Only paid orders can be refunded' });
      const remaining = o.total - o.refundedTotal;
      if (dto.amount > remaining) throw new BadRequestException({ code: 'refund_exceeds_total', message: `Refund exceeds the refundable amount (${remaining})` });
      let restockItems: { variantId: string; quantity: number }[] | undefined;
      if (dto.restock) {
        if (!dto.returnId) throw new BadRequestException({ code: 'restock_needs_return', message: 'Restock requires a return request' });
        const ret = await tx.returnRequest.findFirst({ where: { id: dto.returnId, orderId }, include: { items: { include: { orderItem: true } } } });
        if (!ret || !['received', 'refunded'].includes(ret.status)) throw new BadRequestException({ code: 'return_not_received', message: 'Return must be marked received before restocking' });
        const done = await tx.refund.count({ where: { returnId: ret.id, restock: true } });
        if (done > 0) throw new BadRequestException({ code: 'already_restocked', message: 'This return was already restocked' });
        restockItems = ret.items.map((i) => ({ variantId: i.orderItem.variantId, quantity: i.quantity }));
      }
      const refund = await tx.refund.create({ data: { orderId, paymentId: paid.id, returnId: dto.returnId, amount: dto.amount, reason: dto.reason, actorId: actor.id, restock: dto.restock } });
      const refundedTotal = o.refundedTotal + dto.amount; const full = refundedTotal >= o.total;
      await tx.order.update({ where: { id: orderId }, data: { refundedTotal, paymentStatus: full ? 'refunded' : 'partially_refunded', ...(full && o.status === 'returned' ? { status: 'refunded' } : {}) } });
      await tx.payment.update({ where: { id: paid.id }, data: { status: full ? 'refunded' : 'partially_refunded' } });
      if (full && o.status === 'returned') await tx.orderEvent.create({ data: { orderId, status: 'refunded', note: dto.reason, actorId: actor.id } });
      if (dto.returnId) await tx.returnRequest.update({ where: { id: dto.returnId }, data: { status: 'refunded' } });
      if (restockItems) await this.restock(tx, o, 'return_restock', actor.id, restockItems);
      await tx.notification.create({ data: { userId: o.userId, audience: 'user', type: 'order.refund', title: `Refund issued for ${o.number}`, body: `A refund of ${(dto.amount / 100).toFixed(2)} NPR was recorded.`, data: { orderId } } });
      await this.audit.log(actor, 'refund.create', 'order', orderId, { refundedTotal: o.refundedTotal }, { refundedTotal, amount: dto.amount, reason: dto.reason }, ip, tx);
      return { refund, order: o, full };
    });
    this.events.userEvent(res.order.userId, 'order.updated', { orderId, number: res.order.number });
    this.events.staffEvent('order.updated', { orderId, number: res.order.number });
    if (dto.restock) this.events.publicEvent('inventory.changed', {});
    return res.refund;
  }
}
