import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z as zod } from 'zod';
import { hasPermission, paginationSchema, PERMISSIONS, roleSchema, settingsSchema, SETTING_DEFAULTS, staffUserSchema, staffUserUpdateSchema, ticketMessageSchema, ticketUpdateSchema } from '@smart/shared';
import { AuthUser, ClientIp, CurrentUser, Perms, StaffAny } from '../common/auth';
import { z } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { EventsService } from '../common/events';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';

const q1 = paginationSchema.extend({ q: zod.string().trim().max(100).optional(), status: zod.string().max(20).optional(), entity: zod.string().max(40).optional(), action: zod.string().max(60).optional() });

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService, private audit: AuditService, private events: EventsService, private auth: AuthService, private settings: SettingsService) {}

  // Anyone on staff can read their own capabilities; used by clients to hide navigation.
  @StaffAny() @Get('me') me(@CurrentUser() u: AuthUser) { return this.auth.publicUser(u); }
  @StaffAny() @Get('permissions-catalog') catalog() { return { permissions: PERMISSIONS }; }

  // ---- customers
  @Perms('customers.read') @Get('customers')
  async customers(@Query(z(q1)) q: any) {
    const where: any = { role: { name: 'customer' }, deletedAt: null, ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {}) };
    const [total, rows] = await Promise.all([this.prisma.user.count({ where }), this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true, email: true, name: true, phone: true, active: true, createdAt: true, lastLoginAt: true, _count: { select: { orders: true } } } })]);
    return { items: rows, total, page: q.page, pageSize: q.pageSize };
  }
  @Perms('customers.read') @Get('customers/:id')
  async customer(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, role: { name: 'customer' } }, select: { id: true, email: true, name: true, phone: true, active: true, createdAt: true, lastLoginAt: true, addresses: { where: { deletedAt: null } }, orders: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, number: true, status: true, total: true, createdAt: true } } } });
    if (!u) throw new NotFoundException(); return u;
  }
  @Perms('customers.write') @Patch('customers/:id')
  async setCustomerActive(@Param('id', ParseUUIDPipe) id: string, @Body(z(zod.object({ active: zod.boolean() }).strict())) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const c = await this.prisma.user.findFirst({ where: { id, role: { name: 'customer' } } }); if (!c) throw new NotFoundException();
    await this.prisma.user.update({ where: { id }, data: { active: d.active } });
    if (!d.active) await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log(u, d.active ? 'customer.enable' : 'customer.disable', 'user', id, { active: c.active }, { active: d.active }, ip); return { ok: true };
  }

  // ---- staff users + roles
  @Perms('users.manage') @Get('users')
  users() { return this.prisma.user.findMany({ where: { role: { isStaff: true }, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, email: true, name: true, active: true, lastLoginAt: true, createdAt: true, role: { select: { id: true, name: true, label: true } } } }); }
  @Perms('users.manage') @Get('roles')
  roles() { return this.prisma.role.findMany({ where: { isStaff: true }, orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } }); }

  private async assertCanGrant(actor: AuthUser, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || !role.isStaff) throw new BadRequestException({ code: 'bad_role', message: 'Role not found' });
    // Privilege-escalation guard: you can only hand out roles whose permissions you hold yourself.
    if (!actor.permissions.includes('*')) {
      if (role.permissions.includes('*') || role.permissions.some((p) => !hasPermission(actor.permissions, p))) throw new ForbiddenException({ code: 'escalation_denied', message: 'You cannot assign a role with permissions you do not have' });
    }
    return role;
  }
  @Perms('users.manage') @Post('users')
  async createUser(@Body(z(staffUserSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    await this.assertCanGrant(u, d.roleId);
    if (await this.prisma.user.findUnique({ where: { email: d.email } })) throw new BadRequestException({ code: 'email_taken', message: 'Email already in use' });
    const n = await this.prisma.user.create({ data: { email: d.email, name: d.name, phone: d.phone, active: d.active, roleId: d.roleId, passwordHash: await this.auth.hash(d.password) }, select: { id: true, email: true, name: true, active: true, role: { select: { name: true } } } });
    await this.audit.log(u, 'staff.create', 'user', n.id, undefined, n, ip); return n;
  }
  @Perms('users.manage') @Patch('users/:id')
  async updateUser(@Param('id', ParseUUIDPipe) id: string, @Body(z(staffUserUpdateSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const target = await this.prisma.user.findFirst({ where: { id, role: { isStaff: true }, deletedAt: null }, include: { role: true } }); if (!target) throw new NotFoundException();
    if (target.id === u.id && (d.active === false || (d.roleId && d.roleId !== target.roleId))) throw new BadRequestException({ code: 'self_lockout', message: 'You cannot change your own role or deactivate yourself' });
    if (!u.permissions.includes('*') && (target.role.permissions.includes('*') || target.role.permissions.some((p) => !hasPermission(u.permissions, p)))) throw new ForbiddenException({ code: 'escalation_denied', message: 'You cannot modify a user more privileged than you' });
    if (d.roleId) await this.assertCanGrant(u, d.roleId);
    const { password, ...rest } = d;
    const n = await this.prisma.user.update({ where: { id }, data: { ...rest, ...(password ? { passwordHash: await this.auth.hash(password) } : {}) }, select: { id: true, email: true, name: true, active: true, role: { select: { name: true } } } });
    if (d.active === false || d.roleId || password) await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log(u, 'staff.update', 'user', id, { role: target.role.name, active: target.active }, { ...rest, passwordChanged: !!password }, ip); return n;
  }
  @Perms('roles.manage') @Post('roles')
  async createRole(@Body(z(roleSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    this.checkPerms(d.permissions);
    const r = await this.prisma.role.create({ data: { ...d, isStaff: true } }); await this.audit.log(u, 'role.create', 'role', r.id, undefined, r, ip); return r;
  }
  @Perms('roles.manage') @Put('roles/:id')
  async updateRole(@Param('id', ParseUUIDPipe) id: string, @Body(z(roleSchema.pick({ label: true, permissions: true }))) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const b = await this.prisma.role.findUnique({ where: { id } }); if (!b || !b.isStaff) throw new NotFoundException();
    if (b.name === 'super_admin') throw new BadRequestException({ code: 'protected_role', message: 'super_admin cannot be edited' });
    this.checkPerms(d.permissions);
    const r = await this.prisma.role.update({ where: { id }, data: d }); await this.audit.log(u, 'role.update', 'role', id, b, r, ip); return r;
  }
  private checkPerms(perms: string[]) { for (const p of perms) if (!(PERMISSIONS as readonly string[]).includes(p)) throw new BadRequestException({ code: 'unknown_permission', message: `Unknown permission ${p}` }); }

  // ---- settings
  @Perms('settings.write') @Get('settings') settingsGet() { return this.settings.all(); }
  @Perms('settings.write') @Put('settings')
  async settingsPut(@Body(z(settingsSchema)) d: Record<string, any>, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.settings.all();
    for (const k of Object.keys(d)) if (!(k in SETTING_DEFAULTS)) throw new BadRequestException({ code: 'unknown_setting', message: `Unknown setting ${k}` });
    for (const [k, v] of Object.entries(d)) {
      const def = SETTING_DEFAULTS[k];
      if (typeof v !== typeof def.value && !(v === null)) throw new BadRequestException({ code: 'bad_setting_type', message: `Setting ${k} must be ${typeof def.value}` });
      await this.prisma.setting.upsert({ where: { key: k }, update: { value: v as any }, create: { key: k, value: v as any, isPublic: def.isPublic } });
    }
    await this.audit.log(u, 'settings.update', 'setting', null, before, d, ip);
    this.events.publicEvent('settings.changed', { keys: Object.keys(d) });
    return this.settings.all();
  }

  // ---- audit log
  @Perms('audit.read') @Get('audit-logs')
  async auditLogs(@Query(z(q1)) q: any) {
    const where: any = { ...(q.entity ? { entity: q.entity } : {}), ...(q.action ? { action: { contains: q.action } } : {}), ...(q.q ? { actorEmail: { contains: q.q, mode: 'insensitive' } } : {}) };
    const [total, items] = await Promise.all([this.prisma.auditLog.count({ where }), this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize })]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  // ---- staff notifications
  @Perms('dashboard.view') @Get('notifications')
  async notifications() {
    const items = await this.prisma.notification.findMany({ where: { audience: 'staff' }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { items, unread: items.filter((i) => !i.readAt).length };
  }
  @Perms('dashboard.view') @Post('notifications/read-all')
  async readAll() { await this.prisma.notification.updateMany({ where: { audience: 'staff', readAt: null }, data: { readAt: new Date() } }); return { ok: true }; }

  // ---- tickets
  @Perms('tickets.read') @Get('tickets')
  async tickets(@Query(z(q1)) q: any) {
    const where: any = { ...(q.status ? { status: q.status } : {}), ...(q.q ? { OR: [{ subject: { contains: q.q, mode: 'insensitive' } }, { number: { contains: q.q, mode: 'insensitive' } }] } : {}) };
    const [total, items] = await Promise.all([this.prisma.supportTicket.count({ where }), this.prisma.supportTicket.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { user: { select: { name: true, email: true } } } })]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @Perms('tickets.read') @Get('tickets/:id')
  async ticket(@Param('id', ParseUUIDPipe) id: string) { const t = await this.prisma.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { name: true, email: true } } } }); if (!t) throw new NotFoundException(); return t; }
  @Perms('tickets.manage') @Post('tickets/:id/messages')
  async ticketReply(@Param('id', ParseUUIDPipe) id: string, @Body(z(ticketMessageSchema)) d: any, @CurrentUser() u: AuthUser) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } }); if (!t) throw new NotFoundException();
    const m = await this.prisma.ticketMessage.create({ data: { ticketId: id, authorId: u.id, isStaff: true, internal: !!d.internal, body: d.body } });
    if (!d.internal) {
      await this.prisma.supportTicket.update({ where: { id }, data: { status: 'pending' } });
      await this.prisma.notification.create({ data: { userId: t.userId, audience: 'user', type: 'ticket.reply', title: `Reply on ${t.number}`, body: d.body.slice(0, 120), data: { ticketId: id } } });
      this.events.userEvent(t.userId, 'ticket.reply', { id, number: t.number });
    }
    return m;
  }
  @Perms('tickets.manage') @Patch('tickets/:id')
  async ticketUpdate(@Param('id', ParseUUIDPipe) id: string, @Body(z(ticketUpdateSchema)) d: any, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const b = await this.prisma.supportTicket.findUnique({ where: { id } }); if (!b) throw new NotFoundException();
    const t = await this.prisma.supportTicket.update({ where: { id }, data: d }); await this.audit.log(u, 'ticket.update', 'ticket', id, { status: b.status }, d, ip); return t;
  }
}
