import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async log(actor: Pick<AuthUser, 'id' | 'email'> | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown, ip?: string | null, tx?: any) {
    const client = tx ?? this.prisma;
    const clean = (v: unknown) => v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, val) => (k === 'passwordHash' || k === 'tokenHash' ? undefined : val)));
    await client.auditLog.create({ data: { actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, action, entity, entityId, before: clean(before), after: clean(after), ip: ip ?? null } });
  }
}
