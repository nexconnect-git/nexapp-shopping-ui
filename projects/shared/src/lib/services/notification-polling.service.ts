import { inject, Injectable } from '@angular/core';
import { Notification } from '../models';
import { AlertService } from './alert.service';
import { ApiService } from './api.service';

export type NotifRouteMapper = (
  n: Notification,
) => { label: string; url: string } | null;

@Injectable({ providedIn: 'root' })
export class NotificationPollingService {
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  private seenIds = new Set<string>();
  private consecutiveErrors = 0;
  private isOnline = true;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private mapper: NotifRouteMapper = () => null;
  private onOnline = () => this.handleOnline();
  private onOffline = () => {
    this.isOnline = false;
  };
  private onVisibility = () => {
    if (document.hidden) {
      this._stopInterval();
      return;
    }
    this._startInterval();
    this.poll();
  };

  unreadCount = 0;
  private onUnread: ((count: number) => void) | null = null;

  onUnreadChange(cb: (count: number) => void): void {
    this.onUnread = cb;
  }

  start(mapper?: NotifRouteMapper): void {
    if (mapper) this.mapper = mapper;
    if (this.intervalId !== null) return;

    this.api.getNotifications().subscribe({
      next: (r) =>
        ((r.results || r) as Notification[]).forEach((n) =>
          this.seenIds.add(n.id),
        ),
    });

    window.addEventListener('online', this.onOnline, { passive: true });
    window.addEventListener('offline', this.onOffline, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);

    this._startInterval();
    this.poll();
  }

  stop(): void {
    this._stopInterval();
    this.seenIds.clear();
    this.consecutiveErrors = 0;
    this.isOnline = true;
    this.unreadCount = 0;
    this.api.unreadNotifications.set(0);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private _startInterval(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.poll(), 60_000);
  }

  private _stopInterval(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private poll(): void {
    if (document.hidden) return;

    this.api.getUnreadCount().subscribe({
      next: (r) => {
        const wasOffline = !this.isOnline;
        this.consecutiveErrors = 0;
        this.isOnline = true;

        const count = r.unread_count ?? r.count ?? 0;
        this.unreadCount = count;
        this.api.unreadNotifications.set(count);
        this.onUnread?.(count);

        if (wasOffline) {
          this.handleOnline();
          return;
        }
        if (count > 0) this.fetchAndNotify(false);
      },
      error: () => {
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= 2) this.isOnline = false;

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
        const all = (r.results || r) as Notification[];
        const fresh = all.filter((n) => !this.seenIds.has(n.id));
        all.forEach((n) => this.seenIds.add(n.id));

        if (!fresh.length) return;

        if (isReconnect && fresh.length > 3) {
          this.alerts.info(
            `${fresh.length} new notifications while offline`,
            'Notifications updated',
          );
          return;
        }

        fresh.slice(0, 5).forEach((n) => this.showBanner(n));
      },
    });
  }

  private showBanner(n: Notification): void {
    const tone = n.notification_type === 'order' ? 'success' : 'info';
    const title = n.title || 'New notification';
    const message = n.message || title;

    this.alerts.showBanner({
      title,
      message,
      tone,
      durationMs: 7000,
    });
  }
}
