import { Body, Controller, Get, Headers, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z as zod } from 'zod';
import { cancelSchema, checkoutSchema, ORDER_STATUSES, orderStatusSchema, paginationSchema, refundSchema, returnDecisionSchema, returnSchema, shipSchema } from '@smart/shared';
import { AuthUser, ClientIp, CurrentUser, CustomerOnly, Perms, Public } from '../common/auth';
import { z } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';

const list = paginationSchema.extend({ status: zod.enum(ORDER_STATUSES).optional(), q: zod.string().trim().max(60).optional(), from: zod.coerce.date().optional(), to: zod.coerce.date().optional() });

@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(private orders: OrdersService, private prisma: PrismaService, private payments: PaymentsService) {}

  @Public() @Get('payment-methods') methods() { return this.payments.list(); }

  // ---- customer
  @CustomerOnly() @Post('checkout') @HttpCode(201)
  checkout(@CurrentUser() u: AuthUser, @Body(z(checkoutSchema)) d: any, @Headers('idempotency-key') key: string) { return this.orders.checkout(u, d, key); }

  @CustomerOnly() @Get('me/orders')
  async myOrders(@CurrentUser() u: AuthUser, @Query(z(list)) q: any) {
    const where: any = { userId: u.id, ...(q.status ? { status: q.status } : {}) };
    const [total, items] = await Promise.all([this.prisma.order.count({ where }), this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { items: { select: { name: true, quantity: true, unitPrice: true } } } })]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @CustomerOnly() @Get('me/orders/:id') myOrder(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.orders.mine(u.id, id); }
  @CustomerOnly() @Post('me/orders/:id/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(z(cancelSchema)) d: any, @ClientIp() ip: string) { return this.orders.cancel(id, u, true, d.reason, ip); }
  @CustomerOnly() @Post('me/orders/:id/returns')
  ret(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(z(returnSchema)) d: any) { return this.orders.requestReturn(u, id, d); }
  @CustomerOnly() @Get('me/returns')
  myReturns(@CurrentUser() u: AuthUser) { return this.prisma.returnRequest.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, include: { items: true, order: { select: { number: true } } } }); }
  @CustomerOnly() @Get('me/payments')
  myPayments(@CurrentUser() u: AuthUser) { return this.prisma.payment.findMany({ where: { order: { userId: u.id } }, orderBy: { createdAt: 'desc' }, include: { order: { select: { number: true } }, refunds: { select: { amount: true, createdAt: true, reason: true } } } }); }

  // ---- admin
  @Perms('orders.read') @Get('admin/orders')
  async adminOrders(@Query(z(list)) q: any) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [{ number: { contains: q.q, mode: 'insensitive' } }, { user: { email: { contains: q.q, mode: 'insensitive' } } }, { user: { name: { contains: q.q, mode: 'insensitive' } } }];
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    const [total, items] = await Promise.all([this.prisma.order.count({ where }), this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { user: { select: { id: true, name: true, email: true } }, items: { select: { name: true, quantity: true } } } })]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @Perms('orders.read') @Get('admin/orders/:id')
  async adminOrder(@Param('id', ParseUUIDPipe) id: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: { ...this.orders.orderInclude, user: { select: { id: true, name: true, email: true, phone: true } } } });
    if (!o) throw new NotFoundException({ code: 'not_found', message: 'Order not found' }); return o;
  }
  @Perms('orders.update') @Patch('admin/orders/:id/status')
  status(@Param('id', ParseUUIDPipe) id: string, @Body(z(orderStatusSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    if (d.status === 'cancelled' && !u.permissions.includes('*') && !u.permissions.includes('orders.cancel')) { const { ForbiddenException } = require('@nestjs/common'); throw new ForbiddenException({ code: 'forbidden', message: 'Missing permission' }); }
    return this.orders.setStatus(id, d.status, u, d.note, undefined, ip);
  }
  @Perms('orders.ship') @Post('admin/orders/:id/ship') @HttpCode(200)
  ship(@Param('id', ParseUUIDPipe) id: string, @Body(z(shipSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.orders.setStatus(id, 'shipped', u, d.note, { carrier: d.carrier, trackingNumber: d.trackingNumber }, ip); }

  @Perms('returns.manage') @Get('admin/returns')
  returns(@Query('status') status?: string) { return this.prisma.returnRequest.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { items: { include: { orderItem: { select: { name: true, unitPrice: true } } } }, order: { select: { id: true, number: true, total: true } }, user: { select: { name: true, email: true } } } }); }
  @Perms('returns.manage') @Post('admin/returns/:id/decision') @HttpCode(200)
  decide(@Param('id', ParseUUIDPipe) id: string, @Body(z(returnDecisionSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.orders.decideReturn(id, d.decision, d.adminNote, u, ip); }
  @Perms('refunds.write') @Post('admin/orders/:id/refunds')
  refund(@Param('id', ParseUUIDPipe) id: string, @Body(z(refundSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) { return this.orders.refund(id, d, u, ip); }
  @Perms('payments.read') @Get('admin/payments')
  payments_(@Query(z(paginationSchema)) q: any) { return this.prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { order: { select: { number: true, user: { select: { name: true } } } }, refunds: true } }); }
}
