import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ENV, Env } from '../config/env';
import { AuditService } from '../common/audit';
import type { AuthUser } from '../common/auth';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
// Constant verification target so unknown-email logins cost the same as wrong-password ones.
let DUMMY: string | null = null;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, @Inject(ENV) private env: Env, private audit: AuditService) {}

  hash(pw: string) { return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }); }

  signAccess(user: { id: string }, role: string, audience: string) {
    return jwt.sign({ sub: user.id, role, aud: audience, jti: randomUUID() }, this.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: this.env.JWT_ACCESS_TTL_SECONDS, issuer: 'smart-api' });
  }
  verifyAccess(token: string): { sub: string; role: string; aud: string } {
    try { return jwt.verify(token, this.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'smart-api' }) as any; }
    catch { throw new UnauthorizedException({ code: 'invalid_token', message: 'Invalid or expired token' }); }
  }

  async loadAuthUser(id: string): Promise<AuthUser | null> {
    const u = await this.prisma.user.findFirst({ where: { id, active: true, deletedAt: null }, include: { role: true } });
    if (!u) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role.name, isStaff: u.role.isStaff, permissions: u.role.permissions };
  }

  private async issueRefresh(userId: string, audience: string, familyId: string = randomUUID(), userAgent?: string) {
    const raw = randomBytes(48).toString('base64url');
    const row = await this.prisma.refreshToken.create({ data: { userId, familyId, audience, tokenHash: sha(raw), expiresAt: new Date(Date.now() + this.env.REFRESH_TTL_DAYS * 86400000), userAgent: userAgent?.slice(0, 200) } });
    return { raw, id: row.id };
  }

  async register(dto: { email: string; password: string; name: string; phone?: string }, ip?: string | null, ua?: string) {
    const role = await this.prisma.role.findUnique({ where: { name: 'customer' } });
    if (!role) throw new Error('customer role missing - run db:seed');
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException({ code: 'email_taken', message: 'An account with this email already exists' });
    const user = await this.prisma.user.create({ data: { email: dto.email, name: dto.name, phone: dto.phone, passwordHash: await this.hash(dto.password), roleId: role.id } });
    await this.audit.log({ id: user.id, email: user.email }, 'auth.register', 'user', user.id, undefined, { email: user.email }, ip);
    return this.session(user.id, 'customer', ua);
  }

  async login(dto: { email: string; password: string; audience: 'admin' | 'customer' }, ip?: string | null, ua?: string) {
    const fail = () => new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid email or password' });
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null }, include: { role: true } });
    if (!user) { DUMMY ??= await this.hash('dummy-password-value'); await argon2.verify(DUMMY, dto.password).catch(() => false); throw fail(); }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({ code: 'account_locked', message: 'Too many failed attempts. Try again later.' });
    }
    const ok = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) {
      const failed = user.failedLogins + 1;
      const lock = failed >= this.env.MAX_FAILED_LOGINS;
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + this.env.LOCKOUT_MINUTES * 60000) : null } });
      await this.audit.log({ id: user.id, email: user.email }, lock ? 'auth.lockout' : 'auth.login_failed', 'user', user.id, undefined, undefined, ip);
      throw fail();
    }
    if (!user.active) throw fail();
    const audOk = dto.audience === 'admin' ? user.role.isStaff : !user.role.isStaff;
    if (!audOk) throw fail();
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.log({ id: user.id, email: user.email }, 'auth.login', 'user', user.id, undefined, { audience: dto.audience }, ip);
    return this.session(user.id, dto.audience, ua);
  }

  private async session(userId: string, audience: string, ua?: string, familyId?: string) {
    const au = await this.loadAuthUser(userId);
    if (!au) throw new UnauthorizedException();
    const refresh = await this.issueRefresh(userId, audience, familyId, ua);
    return { accessToken: this.signAccess({ id: userId }, au.role, audience), refreshToken: refresh.raw, expiresIn: this.env.JWT_ACCESS_TTL_SECONDS, user: this.publicUser(au) };
  }
  publicUser(u: AuthUser) { return { id: u.id, email: u.email, name: u.name, role: u.role, isStaff: u.isStaff, permissions: u.permissions }; }

  async refresh(raw: string, ua?: string) {
    const fail = () => new UnauthorizedException({ code: 'invalid_refresh', message: 'Invalid refresh token' });
    if (!raw) throw fail();
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha(raw) } });
    if (!row) throw fail();
    if (row.revokedAt) {
      // Reuse of a rotated token: assume theft, kill the whole family.
      await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ id: row.userId, email: '' }, 'auth.refresh_reuse_detected', 'user', row.userId);
      throw fail();
    }
    if (row.expiresAt < new Date()) throw fail();
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (claimed.count === 0) { await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } }); throw fail(); }
    const s = await this.session(row.userId, row.audience, ua, row.familyId);
    const next = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha(s.refreshToken) } });
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { replacedById: next?.id } });
    return s;
  }

  async logout(raw?: string) {
    if (!raw) return;
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha(raw) } });
    if (row) await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async changePassword(userId: string, current: string, next: string, ip?: string | null) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(u.passwordHash, current).catch(() => false))) throw new BadRequestException({ code: 'wrong_password', message: 'Current password is incorrect' });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hash(next) } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ id: u.id, email: u.email }, 'auth.password_changed', 'user', u.id, undefined, undefined, ip);
  }
}
