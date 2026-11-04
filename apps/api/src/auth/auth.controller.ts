import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { loginSchema, passwordChangeSchema, refreshSchema, registerSchema } from '@smart/shared';
import { AnyUser, ClientIp, CurrentUser, AuthUser, Public, Req as R } from '../common/auth';
import { z } from '../common/zod';
import { AuthService } from './auth.service';
import { cookieName } from './guards';
import { Inject } from '@nestjs/common';
import { ENV, Env } from '../config/env';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, @Inject(ENV) private env: Env) {}

  private setCookies(res: Response, client: string, s: { accessToken: string; refreshToken: string }) {
    const base = { httpOnly: true, sameSite: 'strict' as const, secure: this.env.NODE_ENV === 'production', path: '/' };
    res.cookie(cookieName('at', client), s.accessToken, { ...base, maxAge: this.env.JWT_ACCESS_TTL_SECONDS * 1000 });
    res.cookie(cookieName('rt', client), s.refreshToken, { ...base, path: '/api/v1/auth', maxAge: this.env.REFRESH_TTL_DAYS * 86400000 });
  }
  private clientOf(req: R, audience?: string) { const c = String(req.headers['x-client'] ?? ''); return c === 'admin' || c === 'customer' ? c : audience ?? 'customer'; }

  @Public() @Throttle({ default: { limit: 10, ttl: 60000 } }) @Post('register')
  async register(@Body(z(registerSchema)) dto: any, @Req() req: R, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string) {
    const s = await this.auth.register(dto, ip, req.headers['user-agent']);
    if (req.headers['x-client'] === 'customer') this.setCookies(res, 'customer', s);
    return s;
  }
  @Public() @Throttle({ default: { limit: 10, ttl: 60000 } }) @HttpCode(200) @Post('login')
  async login(@Body(z(loginSchema)) dto: any, @Req() req: R, @Res({ passthrough: true }) res: Response, @ClientIp() ip: string) {
    const s = await this.auth.login(dto, ip, req.headers['user-agent']);
    if (req.headers['x-client']) this.setCookies(res, this.clientOf(req, dto.audience), s);
    return s;
  }
  @Public() @Throttle({ default: { limit: 30, ttl: 60000 } }) @HttpCode(200) @Post('refresh')
  async refresh(@Body(z(refreshSchema)) dto: any, @Req() req: R, @Res({ passthrough: true }) res: Response) {
    const client = this.clientOf(req);
    const raw = dto.refreshToken ?? (req as any).cookies?.[cookieName('rt', client)];
    if (!raw) throw new UnauthorizedException({ code: 'invalid_refresh', message: 'No refresh token' });
    if (!dto.refreshToken && req.headers['x-csrf'] !== '1') throw new UnauthorizedException({ code: 'csrf', message: 'Missing CSRF header' });
    const s = await this.auth.refresh(raw, req.headers['user-agent']);
    if (!dto.refreshToken) this.setCookies(res, client, s);
    return s;
  }
  @Public() @HttpCode(204) @Post('logout')
  async logout(@Body(z(refreshSchema)) dto: any, @Req() req: R, @Res({ passthrough: true }) res: Response) {
    const client = this.clientOf(req);
    await this.auth.logout(dto.refreshToken ?? (req as any).cookies?.[cookieName('rt', client)]);
    res.clearCookie(cookieName('at', client), { path: '/' });
    res.clearCookie(cookieName('rt', client), { path: '/api/v1/auth' });
  }
  @AnyUser() @Get('me')
  me(@CurrentUser() u: AuthUser) { return this.auth.publicUser(u); }
  @AnyUser() @HttpCode(204) @Patch('password')
  async password(@CurrentUser() u: AuthUser, @Body(z(passwordChangeSchema)) dto: any, @ClientIp() ip: string) { await this.auth.changePassword(u.id, dto.currentPassword, dto.newPassword, ip); }
}
