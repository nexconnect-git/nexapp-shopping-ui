import { Component, inject, signal, HostListener, OnInit, DestroyRef, effect } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
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
  private destroyRef = inject(DestroyRef);
  private notifPolling = inject(NotificationPollingService);
  sidebarCollapsed = signal(true);
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<any[]>([]);
  notifLoading = signal(false);
  unreadCount = signal(0);
  private pollingStarted = false;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.startPolling();
      } else if (this.pollingStarted) {
        this.notifPolling.stop();
        this.pollingStarted = false;
        this.unreadCount.set(0);
        this.notifications.set([]);
      }
    });
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) this.startPolling();
  }

  private startPolling() {
    if (this.pollingStarted) return;
    this.pollingStarted = true;
    // notifPolling drives both badges and toasts — no separate timer needed
    this.notifPolling.onUnreadChange((count) => this.unreadCount.set(count));
    this.notifPolling.start((n) => {
      if (n.notification_type === 'order' && n.related_entity_id) {
        return { label: 'View', url: `/orders/${n.related_entity_id}` };
      }
      if (n.notification_type === 'order' && n.data?.order_id) {
        return { label: 'View', url: `/orders/${n.data.order_id}` };
      }
      return null;
    });
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

  isAuthRoute(): boolean {
    const url = this.router.url;
    return url.includes('/login') || url.includes('/register') || url.includes('/change-password');
  }

  isPendingRoute(): boolean {
    return this.router.url.includes('/pending-approval');
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  closeMobileSidebar() {
    this.sidebarCollapsed.set(true);
  }

  breadcrumbs(): Array<{ label: string; url?: string }> {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];
    if (!cleanUrl || cleanUrl === '/') return [{ label: 'Dashboard' }];

    const segments = cleanUrl.split('/').filter(Boolean);
    if (segments[0] === 'products' && segments[1] === 'edit' && segments[2]) {
      return [
        { label: 'Dashboard', url: '/' },
        { label: 'Products', url: '/products' },
        { label: this.productBreadcrumbName(segments[2]) },
      ];
    }
    const crumbs: Array<{ label: string; url?: string }> = [{ label: 'Dashboard', url: '/' }];

    const labelMap: Record<string, string> = {
      'live-orders': 'Live Orders',
      inventory: 'Inventory',
      products: 'Products',
      'catalog-requests': 'Catalog Requests',
      new: 'New Product',
      edit: 'Edit Product',
      orders: 'Orders',
      prep: 'Prep',
      promotions: 'Promotions',
      analytics: 'Analytics',
      payouts: 'Payouts',
      reviews: 'Reviews',
      support: 'Support',
      notifications: 'Notifications',
      'store-settings': 'Store Settings',
    };

    let url = '';
    segments.forEach((segment, index) => {
      url += `/${segment}`;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment);
      const previous = segments[index - 1];
      const label = isUuid
        ? previous === 'orders' ? 'Order Detail' : 'Detail'
        : labelMap[segment] || this.titleCase(segment);
      const isIntermediateAction = segment === 'edit' || segment === 'new' || isUuid;
      crumbs.push({ label, url: index === segments.length - 1 || isIntermediateAction ? undefined : url });
    });

    return crumbs;
  }

  pageTitle(): string {
    const crumbs = this.breadcrumbs();
    return crumbs[crumbs.length - 1]?.label || 'Dashboard';
  }

  private titleCase(value: string): string {
    return value
      .replace(/-/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private productBreadcrumbName(id: string): string {
    return localStorage.getItem(`vendor_product_name_${id}`) || 'Product';
  }

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
    if (n.notification_type === 'order' && (n.data?.order_id || n.related_entity_id)) {
      this.router.navigate(['/orders', n.data?.order_id || n.related_entity_id]);
    } else {
      this.router.navigate(['/']);
    }
  }

  logout() {
    this.auth.logout();
  }
}


