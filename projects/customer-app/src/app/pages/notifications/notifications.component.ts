import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationApi } from '@shared/lib/api/notification-api.service';
import { NotificationStateService } from '@shared/lib/services/notification-state.service';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
  orderId: string;
};

@Component({
  standalone: true,
  imports: [BreadcrumbsComponent, CustomerLockedStateComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent {
  loading = signal(true);
  notifications = signal<NotificationItem[]>([]);

  constructor(
    public auth: AuthService,
    private api: NotificationApi,
    private notificationState: NotificationStateService,
    private router: Router,
  ) {
    if (this.auth.isLoggedIn()) this.loadNotifications();
    else this.loading.set(false);
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update((items) =>
          items.map((item) => ({ ...item, read: true })),
        );
        this.notificationState.unreadNotifications.set(0);
      },
    });
  }

  open(item: NotificationItem): void {
    if (!item.read) {
      this.api.markNotificationRead(item.id).subscribe({
        next: () => {
          this.notifications.update((items) =>
            items.map((entry) =>
              entry.id === item.id ? { ...entry, read: true } : entry,
            ),
          );
          this.refreshUnreadCount();
        },
      });
    }

    if (item.orderId) {
      this.router.navigate(['/tracking', item.orderId]);
      return;
    }
    this.router.navigate(['/orders']);
  }

  private loadNotifications(): void {
    this.loading.set(true);
    this.api.getNotifications().subscribe({
      next: (response) => {
        const entries = this.unwrap(response).map((item) => this.map(item));
        this.notifications.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.notifications.set([]);
        this.loading.set(false);
      },
    });
  }

  private refreshUnreadCount(): void {
    this.api.getUnreadCount().subscribe({
      next: (r) =>
        this.notificationState.unreadNotifications.set(
          r.unread_count ?? r.count ?? 0,
        ),
    });
  }

  private unwrap(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    return [];
  }

  private map(item: any): NotificationItem {
    return {
      id: String(item?.id || ''),
      title: String(item?.title || 'Notification'),
      message: String(item?.message || item?.title || ''),
      type: String(item?.notification_type || 'system'),
      timestamp: item?.created_at
        ? new Date(item.created_at).toLocaleString()
        : 'Recently',
      read: Boolean(item?.is_read),
      orderId: String(item?.related_order || item?.order || item?.order_id || ''),
    };
  }
}
