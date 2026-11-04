import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export type RtScope = 'public' | 'staff' | 'user';
export interface RtEvent { scope: RtScope; type: string; data: unknown; userId?: string; perm?: string; at: string }

/** In-process event bus. Swap for Redis pub/sub when running more than one API instance (documented in docs/REALTIME). */
@Injectable()
export class EventsService {
  private readonly subject = new Subject<RtEvent>();
  readonly stream: Observable<RtEvent> = this.subject.asObservable();
  emit(e: Omit<RtEvent, 'at'>) { this.subject.next({ ...e, at: new Date().toISOString() }); }
  publicEvent(type: string, data: unknown) { this.emit({ scope: 'public', type, data }); }
  staffEvent(type: string, data: unknown, perm = 'orders.read') { this.emit({ scope: 'staff', type, data, perm }); }
  userEvent(userId: string, type: string, data: unknown) { this.emit({ scope: 'user', type, data, userId }); }
}
