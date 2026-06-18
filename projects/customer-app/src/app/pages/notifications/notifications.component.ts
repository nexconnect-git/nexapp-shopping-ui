import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@shared/lib/services/api.service';

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
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent {
  loading = signal(true);
  notifications = signal<NotificationItem[]>([]);

  constructor(
    private api: ApiService,
    private router: Router,
  ) {
    this.loadNotifications();
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update((items) =>
          items.map((item) => ({ ...item, read: true })),
        );
        this.api.refreshUnreadCount();
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
          this.api.refreshUnreadCount();
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
