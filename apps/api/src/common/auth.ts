import { createParamDecorator, ExecutionContext, SetMetadata, applyDecorators } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser { id: string; email: string; name: string; role: string; isStaff: boolean; permissions: string[] }
export type Req = Request & { user?: AuthUser; authVia?: 'bearer' | 'cookie' };

export const IS_PUBLIC = 'isPublic';
export const PERMS = 'perms';
export const CUSTOMER_ONLY = 'customerOnly';
export const ANY_AUTH = 'anyAuth';
export const STAFF_ANY = 'staffAny';

export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route requires ALL listed staff permissions. */
export const Perms = (...p: string[]) => SetMetadata(PERMS, p);
/** Route is for signed-in customers only (ownership still enforced in the service). */
export const CustomerOnly = () => SetMetadata(CUSTOMER_ONLY, true);
/** Any signed-in user (customer or staff) acting on their own record. */
export const AnyUser = () => SetMetadata(ANY_AUTH, true);
/** Any signed-in staff member, no specific permission. */
export const StaffAny = () => SetMetadata(STAFF_ANY, true);

export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Req>().user as AuthUser);
export const ClientIp = createParamDecorator((_d, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>().ip ?? null);
export { applyDecorators };
