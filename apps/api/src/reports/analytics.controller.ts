import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import { z as zod } from 'zod';
import { AuthUser, ClientIp, CurrentUser, Perms } from '../common/auth';
import { z } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';

const daysQ = zod.object({ days: zod.coerce.number().int().min(1).max(365).default(30) });
const repQ = zod.object({ format: zod.enum(['csv', 'xlsx', 'pdf']).default('csv'), days: zod.coerce.number().int().min(1).max(365).default(30) });
const REVENUE_EXCLUDED = ['cancelled', 'pending_payment'] as const;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const csvCell = (v: unknown) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

@ApiTags('analytics')
@Controller('admin')
export class AnalyticsController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  @Perms('analytics.view') @Get('analytics/summary')
  async summary(@Query(z(daysQ)) q: { days: number }) {
    const since = new Date(Date.now() - q.days * 86400000);
    const orders = await this.prisma.order.findMany({ where: { createdAt: { gte: since } }, select: { id: true, status: true, paymentStatus: true, total: true, refundedTotal: true, createdAt: true } });
    const counted = orders.filter((o) => !(REVENUE_EXCLUDED as readonly string[]).includes(o.status));
    const revenue = counted.reduce((a, o) => a + o.total - o.refundedTotal, 0);
    const paidRevenue = counted.filter((o) => ['paid', 'partially_refunded'].includes(o.paymentStatus)).reduce((a, o) => a + o.total - o.refundedTotal, 0);
    const byStatus: Record<string, number> = {}; for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    const series: Record<string, { date: string; orders: number; revenue: number }> = {};
    for (let i = q.days - 1; i >= 0; i--) { const k = dayKey(new Date(Date.now() - i * 86400000)); series[k] = { date: k, orders: 0, revenue: 0 }; }
    for (const o of counted) { const s = series[dayKey(o.createdAt)]; if (s) { s.orders++; s.revenue += o.total - o.refundedTotal; } }
    const top = await this.prisma.orderItem.groupBy({ by: ['productId', 'name'], where: { order: { createdAt: { gte: since }, status: { notIn: [...REVENUE_EXCLUDED] } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: 'desc' } }, take: 8 });
    const [customers, newCustomers, lowStock, openTickets, pendingReturns] = await Promise.all([
      this.prisma.user.count({ where: { role: { name: 'customer' } } }), this.prisma.user.count({ where: { role: { name: 'customer' }, createdAt: { gte: since } } }),
      this.prisma.productVariant.count({ where: { trackInventory: true, product: { deletedAt: null }, stock: { lte: 5 } } }), this.prisma.supportTicket.count({ where: { status: { in: ['open', 'pending'] } } }), this.prisma.returnRequest.count({ where: { status: 'requested' } })]);
    return { days: q.days, currency: 'NPR', orders: orders.length, countedOrders: counted.length, revenue, paidRevenue, averageOrderValue: counted.length ? Math.round(revenue / counted.length) : 0, byStatus, series: Object.values(series), topProducts: top.map((t) => ({ productId: t.productId, name: t.name, quantity: t._sum.quantity ?? 0, revenue: t._sum.lineTotal ?? 0 })), customers, newCustomers, lowStock, openTickets, pendingReturns };
  }

  private async dataset(type: string, days: number) {
    const since = new Date(Date.now() - days * 86400000);
    if (type === 'sales' || type === 'orders') {
      const rows = await this.prisma.order.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } }, take: 5000 });
      return { title: type === 'sales' ? 'Sales report' : 'Orders report', head: ['Order', 'Date', 'Customer', 'Status', 'Payment', 'Subtotal', 'Discount', 'Shipping', 'Tax', 'Total', 'Refunded'], rows: rows.map((o) => [o.number, o.createdAt.toISOString().slice(0, 16).replace('T', ' '), o.user.name, o.status, o.paymentStatus, o.subtotal / 100, o.couponDiscount / 100, o.shippingFee / 100, o.taxTotal / 100, o.total / 100, o.refundedTotal / 100]) };
    }
    if (type === 'inventory') {
      const rows = await this.prisma.productVariant.findMany({ where: { product: { deletedAt: null } }, orderBy: { stock: 'asc' }, include: { product: { select: { name: true } } }, take: 5000 });
      return { title: 'Inventory report', head: ['Product', 'Variant', 'SKU', 'Stock', 'Low-stock at', 'Price'], rows: rows.map((v) => [v.product.name, v.name, v.sku, v.stock, v.lowStockAt, v.price / 100]) };
    }
    if (type === 'customers') {
      const rows = await this.prisma.user.findMany({ where: { role: { name: 'customer' } }, orderBy: { createdAt: 'desc' }, select: { name: true, email: true, createdAt: true, _count: { select: { orders: true } } }, take: 5000 });
      return { title: 'Customers report', head: ['Name', 'Email', 'Joined', 'Orders'], rows: rows.map((u) => [u.name, u.email, u.createdAt.toISOString().slice(0, 10), u._count.orders]) };
    }
    throw new BadRequestException({ code: 'unknown_report', message: 'Report type must be sales, orders, inventory or customers' });
  }

  @Perms('reports.export') @Get('reports/:type')
  async report(@Param('type') type: string, @Query(z(repQ)) q: { format: 'csv' | 'xlsx' | 'pdf'; days: number }, @Res() res: Response, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const ds = await this.dataset(type, q.days);
    await this.audit.log(u, 'report.export', 'report', null, undefined, { type, format: q.format, rows: ds.rows.length }, ip);
    const name = `smart-${type}-${new Date().toISOString().slice(0, 10)}.${q.format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (q.format === 'csv') { res.type('text/csv; charset=utf-8').send('\ufeff' + [ds.head, ...ds.rows].map((r) => r.map(csvCell).join(',')).join('\n')); return; }
    if (q.format === 'xlsx') {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(ds.title.slice(0, 30));
      ws.addRow(ds.head).font = { bold: true };
      for (const r of ds.rows) ws.addRow(r.map((c) => (typeof c === 'string' && /^[=+\-@]/.test(c) ? "'" + c : c)));
      ws.columns.forEach((c) => { c.width = 18; });
      const buf = await wb.xlsx.writeBuffer(); res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(buf)); return;
    }
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    res.type('application/pdf'); doc.pipe(res);
    doc.fontSize(18).text(`S Mart - ${ds.title}`); doc.fontSize(9).fillColor('#555').text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC - last ${q.days} days - ${ds.rows.length} rows`).moveDown();
    doc.fillColor('#000').fontSize(8); const colW = (doc.page.width - 72) / ds.head.length;
    const row = (cells: unknown[], bold = false) => { const y = doc.y; if (y > doc.page.height - 60) doc.addPage(); const yy = doc.y; cells.forEach((c, i) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(String(c ?? '').slice(0, 28), 36 + i * colW, yy, { width: colW - 4, lineBreak: false })); doc.y = yy + 13; doc.x = 36; };
    row(ds.head, true); for (const r of ds.rows.slice(0, 500)) row(r);
    if (ds.rows.length > 500) doc.moveDown().text(`Showing the first 500 of ${ds.rows.length} rows. Use the Excel or CSV export for the full data.`);
    doc.end();
  }
}
