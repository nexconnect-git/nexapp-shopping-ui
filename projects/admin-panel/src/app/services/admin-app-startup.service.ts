import { effect, Injectable, signal } from '@angular/core';
import { AuthService, NotificationPollingService } from '@shared/public-api';

@Injectable({ providedIn: 'root' })
export class AdminAppStartupService {
  readonly unreadCount = signal(0);

  private started = false;

  constructor(
    private readonly auth: AuthService,
    private readonly notifications: NotificationPollingService,
  ) {
    effect(
      () => {
        if (!this.auth.isLoggedIn()) {
          this.notifications.stop();
          this.unreadCount.set(0);
          return;
        }
        this.startNotificationPolling();
      },
      { allowSignalWrites: true },
    );
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.notifications.onUnreadChange((count) => this.unreadCount.set(count));
    if (this.auth.isLoggedIn()) this.startNotificationPolling();
  }

  private startNotificationPolling(): void {
    this.notifications.start((notification) => {
      if (
        notification.notification_type === 'order' &&
        notification.related_entity_id
      ) {
        return {
          label: 'View Order',
          url: `/orders/${notification.related_entity_id}`,
        };
      }
      if (
        notification.notification_type === 'delivery' &&
        notification.related_entity_id
      ) {
        return {
          label: 'View Partner',
          url: `/delivery-partners/${notification.related_entity_id}`,
        };
      }
      return { label: 'View', url: '/notifications' };
    });
  }
}
