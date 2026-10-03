import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  NgZone,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  apiErrorMessage,
  AuthService,
  openAuthenticatedWebSocket,
  VendorOrderCommand,
  VendorOrderSnapshot,
  VendorWorkspaceApi,
} from '@shared/public-api';
import {
  catchError,
  defer,
  finalize,
  Observable,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { environment } from '../../environments/environment';
import { VendorContextService } from './vendor-context.service';

const terminal = new Set(['delivered', 'cancelled']);
@Injectable({ providedIn: 'root' })
export class VendorOrdersStore {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly auth = inject(AuthService);
  private readonly context = inject(VendorContextService);
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  readonly records = signal<ReadonlyMap<string, VendorOrderSnapshot>>(
    new Map()
  );
  readonly active = signal<string[]>([]);
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly errors = signal<ReadonlyMap<string, string>>(new Map());
  readonly loading = signal(false);
  readonly feedError = signal('');
  readonly socketState = signal<
    'connecting' | 'live' | 'reconnecting' | 'offline'
  >('offline');
  readonly lastUpdated = signal<Date | null>(null);
  readonly clock = signal(Date.now());
  private authVersion = this.auth.sessionVersion;
  private socket: WebSocket | null = null;
  private reconnect?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private running = false;
  private session = 0;
  private eventRevision = 0;
  constructor() {
    effect(() => {
      const context = this.context.context();
      const user = this.auth.user();
      if(this.authVersion!==this.auth.sessionVersion){this.stop();this.authVersion=this.auth.sessionVersion;}
      const allowed =
        this.auth.isLoggedIn() &&
        context?.vendor.status === 'approved' &&
        context.vendor.user_info.id === user?.id &&
        !context.vendor.user_info.force_password_change;
      if (allowed && !this.running) {
        this.running = true;
        this.refresh();
        this.connect();
      } else if (!allowed && this.running) this.stop();
    });
    timer(1000, 1000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.clock.set(Date.now()));
    timer(30000, 30000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (this.running && !document.hidden) this.refresh();
      });
    const visible = () => {
      if (!document.hidden && this.running) this.refresh();
    };
    document.addEventListener('visibilitychange', visible);
    this.destroy.onDestroy(() => {
      this.stop();
      document.removeEventListener('visibilitychange', visible);
    });
  }
  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    const session = this.session,
      revision = this.eventRevision;
    this.api
      .liveOrders()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (orders) => {
          if (session !== this.session) return;
          orders.forEach((order) => this.upsert(order));
          this.active.set(
            [
              ...new Set([
                ...orders.map((order) => order.id),
                ...(revision !== this.eventRevision ? this.active() : []),
              ]),
            ].filter(
              (id) => !terminal.has(this.records().get(id)?.status || '')
            )
          );
          this.lastUpdated.set(new Date());
          this.feedError.set('');
          this.loading.set(false);
        },
        error: (error) => {
          if (session === this.session) {
            this.feedError.set(
              apiErrorMessage(
                error,
                'Live orders could not be refreshed. Last successful data remains.'
              )
            );
            this.loading.set(false);
          }
        },
      });
  }
  fetch(id: string): Observable<VendorOrderSnapshot> {
    const session = this.session;
    return this.api.order(id).pipe(
      tap((order) => {
        if (session === this.session) this.upsert(order);
      })
    );
  }
  run(
    id: string,
    action: VendorOrderCommand,
    data: Record<string, string> = {}
  ): Observable<VendorOrderSnapshot> {
    return defer(() => {
      if (this.pending().has(id))
        return throwError(
          () => new Error('An action is already pending for this order.')
        );
      const snapshot = this.records().get(id);
      if (
        snapshot &&
        action !== 'set_status' &&
        !snapshot.allowed_actions.includes(action)
      )
        return throwError(
          () =>
            new Error('This action is no longer available. Refresh the order.')
        );
      const session = this.session;
      this.setPending(id, true);
      this.setError(id, '');
      return this.api.command(id, action, data).pipe(
        tap((order) => {
          if (session === this.session) {
            this.eventRevision++;
            this.upsert(order);
          }
        }),
        catchError((error) => {
          if (session === this.session) {
            this.setError(id, apiErrorMessage(error, 'Order was not changed.'));
            this.fetch(id)
              .pipe(takeUntilDestroyed(this.destroy))
              .subscribe({
                error: () => {
                  this.feedError.set(
                    'Order recovery failed. Refresh to load the current state.'
                  );
                },
              });
          }
          return throwError(() => error);
        }),
        finalize(() => {
          if (session === this.session) this.setPending(id, false);
        })
      );
    });
  }
  can(order: VendorOrderSnapshot, action: VendorOrderCommand): boolean {
    return order.allowed_actions.includes(action);
  }
  upsert(order: VendorOrderSnapshot): void {
    if (
      !order?.id ||
      !order.state_version ||
      !Array.isArray(order.allowed_actions)
    )
      return;
    const current = this.records().get(order.id);
    if (
      current &&
      Date.parse(current.state_version) > Date.parse(order.state_version)
    )
      return;
    this.records.update((records) => new Map(records).set(order.id, order));
    this.active.update((ids) =>
      terminal.has(order.status)
        ? ids.filter((id) => id !== order.id)
        : ids.includes(order.id)
        ? ids
        : [order.id, ...ids]
    );
    this.lastUpdated.set(new Date());
  }
  private connect(): void {
    if (!this.running) return;
    this.socketState.set(this.attempt ? 'reconnecting' : 'connecting');
    const session = this.session;
    this.socket = openAuthenticatedWebSocket(
      '/ws/vendor/operations/',
      this.auth.getToken(),
      environment.apiBaseUrl
    );
    this.socket.onopen = () =>
      this.zone.run(() => {
        if (session !== this.session) return;
        this.attempt = 0;
        this.socketState.set('live');
        this.refresh();
      });
    this.socket.onmessage = (event) =>
      this.zone.run(() => {
        if (session !== this.session) return;
        try {
          const message: unknown = JSON.parse(event.data);
          if (typeof message === 'object' && message && 'payload' in message) {
            const payload = message.payload as { order?: VendorOrderSnapshot };
            if (payload.order) {
              this.eventRevision++;
              this.upsert(payload.order);
            }
          }
        } catch {
          this.refresh();
        }
      });
    this.socket.onerror = () =>
      this.zone.run(() => { if(session===this.session)this.socketState.set('offline'); });
    this.socket.onclose = () =>
      this.zone.run(() => {
        if (!this.running || session !== this.session) return;
        this.socketState.set('reconnecting');
        this.reconnect = setTimeout(
          () => this.connect(),
          Math.min(30000, 1000 * 2 ** this.attempt++)
        );
      });
  }
  private stop(): void {
    this.running = false;
    this.session++;
    if (this.reconnect) clearTimeout(this.reconnect);
    this.socket?.close();
    this.socket = null;
    this.records.set(new Map());
    this.active.set([]);
    this.loading.set(false);
    this.pending.set(new Set());
    this.errors.set(new Map());
    this.socketState.set('offline');
    this.feedError.set('');
    this.lastUpdated.set(null);
  }
  private setPending(id: string, value: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  private setError(id: string, value: string): void {
    this.errors.update((current) => new Map(current).set(id, value));
  }
}
