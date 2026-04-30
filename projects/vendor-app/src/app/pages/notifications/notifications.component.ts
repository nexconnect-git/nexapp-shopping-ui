import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Notification, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  notifications = signal<Notification[]>([]);
  loading = signal(true);
  filter = signal('all');
  filters = ['all', 'order', 'delivery', 'payout', 'approval', 'support', 'system'];

  filtered = computed(() => {
    if (this.filter() === 'all') return this.notifications();
    return this.notifications().filter(n => n.notification_type === this.filter());
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getNotifications().subscribe({
      next: (r) => {
        this.notifications.set(r.results || r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load notifications.', 'error');
      }
    });
  }

  setFilter(filter: string) { this.filter.set(filter); }

  markRead(notification: Notification) {
    this.api.markNotificationRead(notification.id).subscribe({
      next: () => this.notifications.update(list => list.map(n => n.id === notification.id ? { ...n, is_read: true } : n)),
    });
  }

  markAllRead() {
    this.api.markAllNotificationsRead().subscribe({
      next: () => this.notifications.update(list => list.map(n => ({ ...n, is_read: true }))),
    });
  }
}
