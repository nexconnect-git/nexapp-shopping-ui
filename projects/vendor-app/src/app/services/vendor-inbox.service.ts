import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  apiErrorMessage,
  AuthService,
  Notification,
  PageFeatureAccessService,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { timer } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VendorInboxService {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  private readonly features = inject(PageFeatureAccessService);
  readonly unread = signal(0);
  readonly preview = signal<Notification[]>([]);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly revision = signal(0);
  readonly pending = signal<ReadonlySet<string>>(new Set());
  private generation = 0;
  private owner = '';
  private countBusy = false;
  private nextPoll = 0;
  private failures = 0;
  constructor() {
    effect(() => {
      const owner =
        this.auth.isLoggedIn() && this.auth.user()?.role === 'vendor'
          ? this.auth.user()!.id
          : '';
      if (owner !== this.owner) {
        this.owner = owner;
        this.generation++;
        this.countBusy = false;
        this.nextPoll = 0;
        this.failures = 0;
        this.unread.set(0);
        this.preview.set([]);
        this.pending.set(new Set());
        this.loading.set(false);
        this.error.set('');
      }
      if (owner) this.refreshCount();
    });
    const visible = () => {
      if (!document.hidden && this.owner) {
        this.nextPoll = 0;
        this.refreshCount();
      }
    };
    document.addEventListener('visibilitychange', visible);
    this.destroy.onDestroy(() =>
      document.removeEventListener('visibilitychange', visible)
    );
    timer(15000, 15000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (!document.hidden && this.owner && Date.now() >= this.nextPoll)
          this.refreshCount();
      });
  }
  refreshCount(): void {
    if (this.countBusy || !this.owner) return;
    this.countBusy = true;
    const generation = this.generation;
    this.api
      .unread()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (generation === this.generation) {
            this.unread.set(result.unread_count);
            this.failures = 0;
            this.nextPoll = Date.now() + 60000;
            this.countBusy = false;
          }
        },
        error: () => {
          if (generation === this.generation) {
            this.countBusy = false;
            this.nextPoll =
              Date.now() + Math.min(60000 * 2 ** ++this.failures, 600000);
          }
        },
      });
  }
  refreshPreview(): void {
    this.loading.set(true);
    this.error.set('');
    const generation = this.generation;
    this.api
      .notifications({ page: 1 })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (generation === this.generation) {
            this.preview.set(result.results.slice(0, 8));
            this.unread.set(result.unread_count ?? this.unread());
            this.loading.set(false);
          }
        },
        error: (error) => {
          if (generation === this.generation) {
            this.error.set(
              apiErrorMessage(error, 'Could not refresh notifications.')
            );
            this.loading.set(false);
          }
        },
      });
  }
  markRead(notification: Notification): void {
    if (notification.is_read || this.pending().has(notification.id)) return;
    this.setPending(notification.id, true);
    const generation = this.generation;
    this.api
      .markRead(notification.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          if (generation !== this.generation) return;
          this.preview.update((list) =>
            list.map((item) =>
              item.id === notification.id ? { ...item, is_read: true } : item
            )
          );
          this.revision.update((value) => value + 1);
          this.refreshCount();
          this.setPending(notification.id, false);
        },
        error: (error) => {
          if (generation !== this.generation) return;
          this.error.set(
            apiErrorMessage(error, 'Notification remains unread. Retry.')
          );
          this.setPending(notification.id, false);
        },
      });
  }
  markAllRead(): void {
    if (this.pending().has('all')) return;
    this.setPending('all', true);
    const generation = this.generation;
    this.api
      .markAllRead()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          if (generation !== this.generation) return;
          this.preview.update((list) =>
            list.map((item) => ({ ...item, is_read: true }))
          );
          this.revision.update((value) => value + 1);
          this.refreshCount();
          this.setPending('all', false);
        },
        error: (error) => {
          if (generation !== this.generation) return;
          this.error.set(
            apiErrorMessage(error, 'Notifications remain unread. Retry.')
          );
          this.setPending('all', false);
        },
      });
  }
  destination(notification: Notification): string {
    const data = notification.data;
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const id =
      data?.order_id ||
      (['order', 'delivery'].includes(notification.notification_type)
        ? notification.related_entity_id
        : null);
    let route =
      typeof id === 'string' && uuid.test(id)
        ? `/orders/${id}`
        : '/notifications';
    if (
      data?.['product_id'] &&
      typeof data['product_id'] === 'string' &&
      uuid.test(data['product_id'])
    )
      route = `/products/${data['product_id']}/edit`;
    else if (notification.notification_type === 'payout') route = '/payouts';
    else if (
      typeof data?.['proposal_id'] === 'string' &&
      uuid.test(data['proposal_id'])
    )
      route = '/catalog-requests';
    else if (
      data?.['ticket_id'] &&
      typeof data['ticket_id'] === 'string' &&
      uuid.test(data['ticket_id'])
    )
      route = `/support?ticket=${data['ticket_id']}`;
    else if (
      data?.['type'] === 'vendor_approved' ||
      data?.['type'] === 'vendor_rejected'
    )
      route = '/pending-approval';
    return this.features.isRouteEnabled('vendor-app', route.split('?')[0])
      ? route
      : '/feature-unavailable';
  }
  private setPending(id: string, value: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
