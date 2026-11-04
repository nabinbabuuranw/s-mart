import { BadRequestException, Controller, Get, Header, HttpCode, Inject, NotFoundException, Param, Post, Query, Req, Res, Sse, UnauthorizedException, UploadedFile, UseInterceptors, MessageEvent, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Observable, filter, interval, map, merge } from 'rxjs';
import { hasPermission } from '@smart/shared';
import { AnyUser, AuthUser, ClientIp, CurrentUser, Perms, Public } from '../common/auth';
import { EventsService, RtEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { AuthService } from '../auth/auth.service';
import { ENV, Env } from '../config/env';

// ---------- storage interface (swap LocalStorage for S3/R2 later) ----------
export interface StorageDriver { put(name: string, data: Buffer): Promise<string>; get(name: string): Promise<Buffer | null> }
export class LocalStorage implements StorageDriver {
  constructor(private dir: string) {}
  private safe(name: string) { if (!/^[A-Za-z0-9._-]{1,100}$/.test(name) || name.includes('..')) throw new BadRequestException('Bad file name'); return path.join(path.resolve(this.dir), name); }
  async put(name: string, data: Buffer) { await fs.mkdir(path.resolve(this.dir), { recursive: true }); await fs.writeFile(this.safe(name), data, { flag: 'wx' }); return name; }
  async get(name: string) { try { return await fs.readFile(this.safe(name)); } catch (e: any) { if (e instanceof BadRequestException) throw e; return null; } }
}
export function sniffImage(b: Buffer): { ext: string; mime: string } | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (b.length > 6 && (b.subarray(0, 6).toString() === 'GIF87a' || b.subarray(0, 6).toString() === 'GIF89a')) return { ext: 'gif', mime: 'image/gif' };
  return null;
}
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const FILE_RE = /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|png|webp|gif)|demo-[a-z0-9-]{1,60}\.svg)$/;

@ApiTags('platform')
@Controller()
export class PlatformController {
  private storage: StorageDriver;
  private tickets = new Map<string, { user: AuthUser; exp: number }>();
  constructor(private prisma: PrismaService, private events: EventsService, private audit: AuditService, private auth: AuthService, @Inject(ENV) private env: Env) { this.storage = new LocalStorage(env.UPLOAD_DIR); }

  @Public() @Get('health')
  async health() { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ok', time: new Date().toISOString(), version: '1.0.0-m1' }; }

  // ---------- uploads ----------
  @Perms('uploads.write') @Post('admin/uploads') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  async upload(@UploadedFile() file: { buffer: Buffer; size: number }, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    if (!file) throw new BadRequestException({ code: 'no_file', message: 'Attach an image in the "file" field' });
    const kind = sniffImage(file.buffer); // content sniffing, never trust the client mimetype or filename
    if (!kind) throw new BadRequestException({ code: 'unsupported_type', message: 'Only PNG, JPEG, WebP or GIF images are accepted' });
    const name = `${randomUUID()}.${kind.ext}`;
    await this.storage.put(name, file.buffer);
    await this.audit.log(u, 'upload.create', 'file', name, undefined, { bytes: file.size, type: kind.mime }, ip);
    return { url: `/api/v1/files/${name}`, name, bytes: file.size, type: kind.mime };
  }
  @Public() @Get('files/:name')
  async file(@Param('name') name: string, @Res() res: Response) {
    if (!FILE_RE.test(name)) throw new NotFoundException();
    const buf = await this.storage.get(name); if (!buf) throw new NotFoundException();
    const ext = name.split('.').pop()!;
    res.setHeader('Content-Type', MIME[ext]); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox"); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buf);
  }

  // ---------- realtime (SSE) ----------
  @AnyUser() @Post('realtime/ticket') @HttpCode(200)
  ticket(@CurrentUser() u: AuthUser) {
    const t = randomBytes(24).toString('base64url');
    this.tickets.set(t, { user: u, exp: Date.now() + 60000 });
    for (const [k, v] of this.tickets) if (v.exp < Date.now()) this.tickets.delete(k);
    return { ticket: t, expiresIn: 60 };
  }
  /** Public events (catalog/price/banner/offer/settings) need no auth; private events need a one-time ticket. */
  @Public() @Sse('realtime/stream')
  stream(@Query('ticket') ticket?: string): Observable<MessageEvent> {
    let user: AuthUser | null = null;
    if (ticket) {
      const t = this.tickets.get(ticket); this.tickets.delete(ticket);
      if (!t || t.exp < Date.now()) throw new UnauthorizedException({ code: 'bad_ticket', message: 'Invalid or expired ticket' });
      user = t.user;
    }
    const allow = (e: RtEvent) => e.scope === 'public' || (!!user && ((e.scope === 'user' && e.userId === user.id) || (e.scope === 'staff' && user.isStaff && hasPermission(user.permissions, e.perm ?? 'orders.read'))));
    const events$ = this.events.stream.pipe(filter(allow), map((e) => ({ type: e.type, data: { ...((e.data as object) ?? {}), at: e.at } }) as MessageEvent));
    const hello$ = new Observable<MessageEvent>((s) => { s.next({ type: 'hello', data: { authenticated: !!user } }); });
    const beat$ = interval(25000).pipe(map(() => ({ type: 'ping', data: {} }) as MessageEvent));
    return merge(hello$, events$, beat$);
  }

  // ---------- backups ----------
  private async pgTool(tool: string, args: string[]) {
    const env = { ...process.env } as Record<string, string>;
    const u = new URL(this.env.DATABASE_URL); env.PGPASSWORD = decodeURIComponent(u.password);
    const base = ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username)];
    return new Promise<string>((resolve, reject) => execFile(tool, [...base, ...args], { env, timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, out, errOut) => (err ? reject(new Error(errOut || err.message)) : resolve(out))));
  }
  @Perms('backup.manage') @Get('admin/backups')
  async backups() {
    const dir = path.resolve(this.env.BACKUP_DIR); await fs.mkdir(dir, { recursive: true });
    const names = (await fs.readdir(dir)).filter((n) => /^smart-[0-9TZ-]+\.dump$/.test(n)).sort().reverse();
    const items = await Promise.all(names.map(async (n) => { const st = await fs.stat(path.join(dir, n)); return { name: n, bytes: st.size, createdAt: st.mtime }; }));
    const verifs = await this.prisma.auditLog.findMany({ where: { action: 'backup.verify' }, orderBy: { createdAt: 'desc' }, take: 10 });
    return { items, lastVerification: verifs[0] ? { at: verifs[0].createdAt, result: verifs[0].after } : null };
  }
  @Perms('backup.manage') @Post('admin/backups') @HttpCode(201)
  async runBackup(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const dir = path.resolve(this.env.BACKUP_DIR); await fs.mkdir(dir, { recursive: true });
    const name = `smart-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}Z.dump`;
    try { await this.pgTool('pg_dump', ['-Fc', '-f', path.join(dir, name), new URL(this.env.DATABASE_URL).pathname.slice(1)]); }
    catch (e: any) { throw new BadRequestException({ code: 'backup_failed', message: 'Backup failed: ' + String(e.message).slice(0, 200) }); }
    const st = await fs.stat(path.join(dir, name));
    await this.audit.log(u, 'backup.create', 'backup', name, undefined, { bytes: st.size }, ip);
    return { name, bytes: st.size };
  }
  /** Restores into a throw-away database and compares row counts, then drops it. Never touches the live DB. */
  @Perms('backup.manage') @Post('admin/backups/:name/verify') @HttpCode(200)
  async verify(@Param('name') name: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    if (!/^smart-[0-9TZ-]+\.dump$/.test(name)) throw new NotFoundException();
    const file = path.join(path.resolve(this.env.BACKUP_DIR), name); try { await fs.access(file); } catch { throw new NotFoundException(); }
    const scratch = `smart_restore_${Date.now()}`;
    const live = new URL(this.env.DATABASE_URL).pathname.slice(1);
    const tables = ['User', 'Product', 'ProductVariant', 'Order', 'OrderItem', 'AuditLog'];
    let result: any;
    try {
      await this.pgTool('createdb', [scratch]);
      await this.pgTool('pg_restore', ['--no-owner', '-d', scratch, file]);
      const counts = async (db: string) => { const o: Record<string, number> = {}; for (const t of tables) o[t] = Number((await this.pgTool('psql', ['-d', db, '-At', '-c', `SELECT count(*) FROM "${t}"`])).trim()); return o; };
      const restored = await counts(scratch);
      const liveCounts = await counts(live);
      // The live DB may have grown since the dump; the restored data must never exceed live and must be non-empty.
      const ok = tables.every((t) => restored[t] <= liveCounts[t]) && restored.User > 0;
      result = { ok, restored, live: liveCounts, scratch };
    } catch (e: any) { result = { ok: false, error: String(e.message).slice(0, 300) }; }
    finally { await this.pgTool('dropdb', ['--if-exists', scratch]).catch(() => undefined); }
    await this.audit.log(u, 'backup.verify', 'backup', name, undefined, result, ip);
    return result;
  }
}
