import { inject, Injectable, signal } from '@angular/core';
import { HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminConnectionService {
  state = signal<'connecting' | 'connected' | 'offline' | 'degraded'>('connecting');
  lastResponse = signal<Date | null>(null);
}
export const adminConnectionInterceptor: HttpInterceptorFn = (req, next) => {
  const connection = inject(AdminConnectionService);
  return next(req).pipe(tap({
    next: event => { if (event.type === HttpEventType.Response) { connection.state.set('connected'); connection.lastResponse.set(new Date()); } },
    error: error => { if (error.status === 0) connection.state.set('offline'); else if (error.status >= 500) connection.state.set('degraded'); },
  }));
};
