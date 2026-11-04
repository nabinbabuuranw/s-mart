import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR; let code = 'internal_error'; let message = 'Internal server error'; let details: unknown;
    if (e instanceof HttpException) {
      status = e.getStatus();
      const r = e.getResponse() as any;
      if (typeof r === 'string') { message = r; code = String(HttpStatus[status] ?? 'error').toLowerCase(); }
      else { message = Array.isArray(r.message) ? r.message.join('; ') : r.message ?? e.message; code = r.code ?? String(r.error ?? HttpStatus[status] ?? 'error').toLowerCase().replace(/\s+/g, '_'); details = r.details; }
    } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') { status = 409; code = 'conflict'; message = 'A record with the same unique value already exists'; }
      else if (e.code === 'P2025') { status = 404; code = 'not_found'; message = 'Record not found'; }
      else if (e.code === 'P2003') { status = 409; code = 'conflict'; message = 'Related record constraint failed'; }
      else { this.log.error(`${req.method} ${req.url} prisma ${e.code}`); }
    } else {
      this.log.error(`${req.method} ${req.url} ${(e as Error)?.stack ?? e}`);
    }
    if (res.headersSent) return;
    res.status(status).json({ error: { code, message, details, status, requestId: req.id } });
  }
}
