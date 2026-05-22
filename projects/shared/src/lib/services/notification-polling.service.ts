import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AlertService } from './alert.service';

export type NotifRouteMapper = (
  n: any,
) => { label: string; url: string } | null;

/**
 * Centralised notification-polling service.
 *
 * Improvements:
 *  - Polls every 60s (was 5s) to avoid saturating the backend with parallel tabs.
 *  - Pauses automatically when the tab is hidden (visibilitychange API).
 *  - Removes duplicate: AppComponent no longer needs its own getUnreadCount poll.
 *  - Exposes unreadCount so AppComponent can read it reactively.
 *  - Exponential back-off on consecutive errors (max 5 min).
 *  - Uses the shared alert host instead of the legacy toast UI.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPollingService {
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  private seenIds = new Set<string>();
  private consecutiveErrors = 0;
  private isOnline = true;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private mapper: NotifRouteMapper = () => null;

  // Publicly readable unread count — AppComponent binds to this
  unreadCount = 0;
  private _onUnreadChange: ((count: number) => void) | null = null;

  /** Subscribe to unread-count changes. */
  onUnreadChange(cb: (count: number) => void): void {
    this._onUnreadChange = cb;
  }

  /** Call once when the user is authenticated. Safe to call multiple times — no-ops after first. */
  start(mapper?: NotifRouteMapper): void {
    if (mapper) this.mapper = mapper;
    if (this.intervalId !== null) return; // already running

    // Seed seen-IDs without surfacing old notifications on boot.
    this.api.getNotifications().subscribe({
      next: (r) => (r.results || r).forEach((n: any) => this.seenIds.add(n.id)),
    });

    window.addEventListener('online', () => this.handleOnline(), {
      passive: true,
    });
    window.addEventListener(
      'offline',
      () => {
        this.isOnline = false;
      },
      { passive: true },
    );

    // Pause polling when tab is not visible — saves CPU and network across all open tabs.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._stopInterval();
      } else {
        this._startInterval();
        this.poll(); // immediate catch-up poll on focus
      }
    });

    this._startInterval();
  }

  /** Tear down (call on logout or app destroy). */
  stop(): void {
    this._stopInterval();
    this.seenIds.clear();
    this.consecutiveErrors = 0;
    this.isOnline = true;
    this.unreadCount = 0;
  }

  private _startInterval(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.poll(), 60_000); // 60s — was 5s
  }

  private _stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private poll(): void {
    // Skip if tab is hidden — battery & network friendly
    if (document.hidden) return;

    this.api.getUnreadCount().subscribe({
      next: (r) => {
        const wasOffline = !this.isOnline;
        this.consecutiveErrors = 0;
        this.isOnline = true;

        const count = r.count ?? 0;
        this.unreadCount = count;
        this._onUnreadChange?.(count);

        if (wasOffline) {
          this.handleOnline();
          return;
        }
        if (count > 0) {
          this.fetchAndNotify(false);
        }
      },
      error: () => {
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= 2) this.isOnline = false;

        // Exponential back-off: temporarily extend interval on repeated errors
        // (max ceiling 5 min). We restart the interval with the longer delay.
        if (this.consecutiveErrors >= 3) {
          this._stopInterval();
          const backoffMs = Math.min(
            60_000 * Math.pow(2, this.consecutiveErrors - 2),
            300_000,
          );
          setTimeout(() => {
            if (this.intervalId === null) this._startInterval();
          }, backoffMs);
        }
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
          this.alerts.info(
            `${fresh.length} new notifications while offline`,
            'Notifications updated',
          );
        } else {
          fresh.slice(0, 5).forEach((n) => this.showBanner(n));
        }
      },
    });
  }

  private showBanner(n: any): void {
    const type = n.notification_type === 'order' ? 'success' : 'info';
    const title = n.title || 'New notification';
    const message = n.message || title;

    this.alerts.showBanner({
      title,
      message,
      tone: type,
      durationMs: 7000,
    });
  }
}
