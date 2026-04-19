import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, ApiService, ToastComponent, NotificationPollingService } from '@shared/public-api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  private router = inject(Router);
  private notifPolling = inject(NotificationPollingService);
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<any[]>([]);
  notifLoading = signal(false);
  unreadCount = signal(0);

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.notifPolling.start((n) => {
        if (n.notification_type === 'order') return { label: 'View', url: '/orders' };
        return null;
      });
    }
    // Unread count is driven by NotificationPollingService — no extra timer needed here
    this.notifPolling.onUnreadChange((count) => this.unreadCount.set(count));
  }

  toggleProfile(event?: Event) {
    event?.stopPropagation();
    this.profileOpen.update(v => !v);
    this.notifOpen.set(false);
  }

  toggleNotif(event: Event) {
    event.stopPropagation();
    const opening = !this.notifOpen();
    this.notifOpen.set(opening);
    this.profileOpen.set(false);
    if (opening && this.notifications().length === 0) this.fetchNotifications();
  }

  fetchNotifications() {
    this.notifLoading.set(true);
    this.api.getNotifications().subscribe({
      next: (r) => { this.notifications.set((r.results || r).slice(0, 8)); this.notifLoading.set(false); },
      error: () => this.notifLoading.set(false)
    });
  }

  markAllRead() {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update(list => list.map((n: any) => ({ ...n, is_read: true })));
      },
      error: () => {}
    });
  }

  @HostListener('document:click')
  closeDropdowns() { this.profileOpen.set(false); this.notifOpen.set(false); }

  closeProfile() { this.profileOpen.set(false); }

  handleNotificationClick(n: any) {
    if (!n.is_read) {
      this.api.markNotificationRead(n.id).subscribe({
        next: () => {
          this.unreadCount.update(c => Math.max(0, c - 1));
          this.notifications.update(list =>
            list.map(item => item.id === n.id ? { ...item, is_read: true } : item)
          );
        },
      });
    }
    this.notifOpen.set(false);
    if (n.notification_type === 'order') {
      this.router.navigate(['/orders']);
    } else {
      this.router.navigate(['/']);
    }
  }

  isAuthRoute(): boolean {
    const url = this.router.url;
    return url.includes('/login') || url.includes('/change-password');
  }
}


