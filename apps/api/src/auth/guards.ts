import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_AUTH, CUSTOMER_ONLY, IS_PUBLIC, PERMS, Req, STAFF_ANY } from '../common/auth';
import { AuthService } from './auth.service';
import { hasAllPermissions } from '@smart/shared';

export const cookieName = (kind: 'at' | 'rt', client: string) => `sm_${client}_${kind}`;

/**
 * One global guard = default deny. A route with no access decorator is refused (403),
 * so a forgotten decorator can never expose an endpoint.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector, private auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const get = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    if (get<boolean>(IS_PUBLIC)) return true;
    const req = ctx.switchToHttp().getRequest<Req>();
    const hdr = req.headers.authorization;
    let token: string | undefined;
    if (hdr?.startsWith('Bearer ')) { token = hdr.slice(7).trim(); req.authVia = 'bearer'; }
    else {
      const client = String(req.headers['x-client'] ?? '');
      if (client === 'admin' || client === 'customer') {
        token = (req as any).cookies?.[cookieName('at', client)];
        req.authVia = 'cookie';
        if (token && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-csrf'] !== '1') {
          throw new ForbiddenException({ code: 'csrf', message: 'Missing CSRF header' });
        }
      }
    }
    if (!token) throw new UnauthorizedException({ code: 'unauthenticated', message: 'Authentication required' });
    const claims = this.auth.verifyAccess(token);
    const user = await this.auth.loadAuthUser(claims.sub);
    if (!user) throw new UnauthorizedException({ code: 'unauthenticated', message: 'Account unavailable' });
    // A token minted for the admin audience must belong to staff, and vice versa.
    if ((claims.aud === 'admin') !== user.isStaff) throw new ForbiddenException({ code: 'audience_mismatch', message: 'Token not valid for this account type' });
    req.user = user;
    if (get<boolean>(ANY_AUTH)) return true;
    if (get<boolean>(CUSTOMER_ONLY)) { if (user.isStaff) throw new ForbiddenException({ code: 'forbidden', message: 'Customer endpoint' }); return true; }
    if (get<boolean>(STAFF_ANY)) { if (!user.isStaff) throw new ForbiddenException({ code: 'forbidden', message: 'Staff only' }); return true; }
    const perms = get<string[]>(PERMS);
    if (perms) {
      if (!user.isStaff || !hasAllPermissions(user.permissions, perms)) throw new ForbiddenException({ code: 'forbidden', message: 'Missing permission' });
      return true;
    }
    throw new ForbiddenException({ code: 'no_access_policy', message: 'Route has no access policy' });
  }
}
