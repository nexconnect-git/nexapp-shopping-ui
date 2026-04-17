import { Component, signal, inject, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, ApiService, ToastComponent, NotificationPollingService } from '@shared/public-api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  private router = inject(Router);
  private notifPolling = inject(NotificationPollingService);

  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<any[]>([]);
  notifLoading = signal(false);
  unreadCount = signal(0);

  get navItems() {
    const items = [
      { route: '/', icon: 'dashboard', label: 'Dashboard' },
      { route: '/vendors', icon: 'storefront', label: 'Vendors' },
      { route: '/customers', icon: 'people', label: 'Customers' },
      { route: '/delivery-partners', icon: 'local_shipping', label: 'Delivery Partners' },
      { route: '/categories', icon: 'category', label: 'Categories' },
      { route: '/assets', icon: 'handyman', label: 'Assets' },
      { route: '/payouts', icon: 'payments', label: 'Payouts' },
      { route: '/payments', icon: 'receipt_long', label: 'Payments' },
      { route: '/issues', icon: 'report_problem', label: 'Order Issues' },
      { route: '/coupons', icon: 'confirmation_number', label: 'Coupons' },
      { route: '/scheduled-tasks', icon: 'schedule_send', label: 'Scheduled Tasks' },
      { route: '/notifications', icon: 'notifications', label: 'Notifications' },
    ];
    
    if (this.auth.isSuperUser()) {
      items.push({ route: '/admin-users', icon: 'admin_panel_settings', label: 'Admin Management' });
    }
    
    return items;
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.startPolling();
    }
  }

  private startPolling() {
    // notifPolling drives both badges and toasts — no separate timer needed
    this.notifPolling.onUnreadChange((count) => this.unreadCount.set(count));

    // Live toast notifications via polling service
    this.notifPolling.start((n) => {
      if (n.notification_type === 'order' && n.related_entity_id) {
        return { label: 'View Order', url: `/orders/${n.related_entity_id}` };
      }
      if (n.notification_type === 'delivery' && n.related_entity_id) {
        return { label: 'View Partner', url: `/delivery-partners/${n.related_entity_id}` };
      }
      return { label: 'View', url: '/notifications' };
    });
  }

  toggleProfile(event: Event) {
    event.stopPropagation();
    const opening = !this.profileOpen();
    this.profileOpen.set(opening);
    this.notifOpen.set(false);
  }

  toggleNotif(event: Event) {
    event.stopPropagation();
    const opening = !this.notifOpen();
    this.notifOpen.set(opening);
    this.profileOpen.set(false);
    if (opening) {
      this.fetchNotifications();
    }
  }

  fetchNotifications() {
    if (!this.auth.isLoggedIn()) return;
    this.notifLoading.set(true);
    this.api.getAdminNotifications({ page: 1, page_size: 8 }).subscribe({
      next: (r: any) => {
        const items = (r.results || r).slice(0, 8);
        this.notifications.set(items);
        this.notifLoading.set(false);
      },
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
  closeDropdowns() {
    this.profileOpen.set(false);
    this.notifOpen.set(false);
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  getInitials(): string {
    const user = this.auth.user();
    if (!user) return 'A';
    if (user.first_name && user.last_name) {
      return user.first_name[0] + user.last_name[0];
    }
    return (user.username?.[0] || 'A').toUpperCase();
  }

  logout() {
    this.profileOpen.set(false);
    this.auth.logout();
  }

  notifIcon(type: string): string {
    const map: Record<string, string> = {
      order: 'receipt_long',
      delivery: 'local_shipping',
      promo: 'local_offer',
      system: 'info' };
    return map[type] || 'notifications';
  }

  goToNotifications() {
    this.notifOpen.set(false);
    this.router.navigate(['/notifications']);
  }

  handleNotificationClick(n: any) {
    if (!n.is_read) {
      this.api.markNotificationRead(n.id).subscribe({
        next: () => {
          this.unreadCount.update(c => Math.max(0, c - 1));
          this.notifications.update(list => list.map(item => item.id === n.id ? { ...item, is_read: true } : item));
        }
      });
    }
    this.notifOpen.set(false);
    
    if (n.notification_type === 'order' && n.related_entity_id) {
       this.router.navigate(['/orders', n.related_entity_id]);
    } else if (n.notification_type === 'delivery' && n.related_entity_id) {
       this.router.navigate(['/delivery-partners', n.related_entity_id]);
    } else {
       this.router.navigate(['/notifications']);
    }
  }
}


