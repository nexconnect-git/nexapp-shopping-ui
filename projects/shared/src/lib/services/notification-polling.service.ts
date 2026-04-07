import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';

export type NotifRouteMapper = (n: any) => { label: string; url: string } | null;

/**
 * Centralised notification-polling service.
 *
 * Usage (in each AppComponent.ngOnInit, after the user is confirmed logged-in):
 *   this.notifPolling.start((n) => { ... return { label, url } or null; });
 *
 * Behaviour:
 *  - Polls getUnreadCount every 5 s.
 *  - On new count: fetches notifications and shows a toast per new item (up to 5).
 *  - Deduplicates by notification ID — the same toast is never shown twice.
 *  - Detects offline/reconnect via browser events + consecutive HTTP errors.
 *  - On reconnect: if ≤ 3 missed → individual toasts; if > 3 → single summary toast.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPollingService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  private seenIds = new Set<string>();
  private consecutiveErrors = 0;
  private isOnline = true;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private mapper: NotifRouteMapper = () => null;

  /** Call once when the user is authenticated. Safe to call multiple times — no-ops after first. */
  start(mapper?: NotifRouteMapper): void {
    if (mapper) this.mapper = mapper;
    if (this.intervalId !== null) return; // already running

    // Seed seen-IDs without showing toasts so old notifications don't toast on boot.
    this.api.getNotifications().subscribe({
      next: (r) => (r.results || r).forEach((n: any) => this.seenIds.add(n.id)),
    });

    window.addEventListener('online', () => this.handleOnline(), { passive: true });
    window.addEventListener('offline', () => { this.isOnline = false; }, { passive: true });

    this.intervalId = setInterval(() => this.poll(), 5000);
  }

  /** Tear down (call on logout or app destroy). */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.seenIds.clear();
    this.consecutiveErrors = 0;
    this.isOnline = true;
  }

  private poll(): void {
    this.api.getUnreadCount().subscribe({
      next: (r) => {
        const wasOffline = !this.isOnline;
        this.consecutiveErrors = 0;
        this.isOnline = true;

        if (wasOffline) {
          this.handleOnline();
          return;
        }
        if ((r.count ?? 0) > 0) {
          this.fetchAndNotify(false);
        }
      },
      error: () => {
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= 2) this.isOnline = false;
      },
    });
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.consecutiveErrors = 0;
    this.fetchAndNotify(true);
  }

  private fetchAndNotify(isReconnect: boolean): void {
    this.api.getNotifications().subscribe({
      next: (r) => {
        const all: any[] = r.results || r;
        const fresh = all.filter((n) => !this.seenIds.has(n.id));
        all.forEach((n) => this.seenIds.add(n.id));

        if (!fresh.length) return;

        if (isReconnect && fresh.length > 3) {
          this.toast.show(
            `${fresh.length} new notifications while offline`,
            'info',
            'View all',
            '/notifications',
            7000,
          );
        } else {
          fresh.slice(0, 5).forEach((n) => this.showToast(n));
        }
      },
    });
  }

  private showToast(n: any): void {
    const action = this.mapper(n);
    const type = n.notification_type === 'order' ? 'success' : 'info';
    this.toast.show(n.title || n.message || 'New notification', type, action?.label, action?.url);
  }
}
