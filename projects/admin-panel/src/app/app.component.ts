import { Component, signal, inject, OnInit, HostListener } from '@angular/core';
import { NavigationEnd, RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
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
  breadcrumbs = signal<Array<{ label: string; url?: string }>>([]);

  get navSections() {
    const operations = [
      { route: '/', icon: 'speed', label: 'Command Center' },
      { route: '/orders', icon: 'receipt_long', label: 'Live Orders' },
      { route: '/dispatch', icon: 'route', label: 'Dispatch Board' },
      { route: '/delivery-partners', icon: 'two_wheeler', label: 'Dispatch Fleet' },
      { route: '/issues', icon: 'support_agent', label: 'Exceptions' },
    ];

    const marketplace = [
      { route: '/vendors', icon: 'storefront', label: 'Stores' },
      { route: '/catalog', icon: 'inventory_2', label: 'Master Catalog' },
      { route: '/catalog-requests', icon: 'playlist_add_check', label: 'Catalog Requests' },
      { route: '/vendor-variant-approvals', icon: 'rule', label: 'Product Approvals' },
      { route: '/products', icon: 'store', label: 'Vendor Products' },
      { route: '/categories', icon: 'category', label: 'Categories' },
      { route: '/customers', icon: 'groups', label: 'Customers' },
    ];

    const growth = [
      { route: '/coupons', icon: 'local_activity', label: 'Promotions' },
      { route: '/notifications', icon: 'campaign', label: 'Notifications' },
      { route: '/assets', icon: 'handyman', label: 'Assets' },
    ];

    const finance = [
      { route: '/payments', icon: 'credit_card', label: 'Payments' },
      { route: '/payouts', icon: 'account_balance_wallet', label: 'Payouts' },
      { route: '/reconciliation', icon: 'fact_check', label: 'Reconciliation' },
      { route: '/scheduled-tasks', icon: 'event_repeat', label: 'Automation' },
    ];

    const access = [
      { route: '/platform-settings', icon: 'tune', label: 'Platform Settings' },
      { route: '/audit-logs', icon: 'manage_search', label: 'Audit Logs' },
      { route: '/production-readiness', icon: 'verified', label: 'Readiness' },
    ];
    if (this.auth.isSuperUser()) {
      access.push({ route: '/admin-users', icon: 'admin_panel_settings', label: 'Admin Access' });
    }

    return [
      { label: 'Operate', items: operations },
      { label: 'Marketplace', items: marketplace },
      { label: 'Growth', items: growth },
      { label: 'Money', items: finance },
      ...(access.length ? [{ label: 'Govern', items: access }] : []),
    ];
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.startPolling();
    }
    this.setBreadcrumbs(this.router.url);
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.setBreadcrumbs(event.urlAfterRedirects);
    });
  }

  private setBreadcrumbs(url: string) {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; url?: string }> = [{ label: 'Command Center', url: '/' }];
    const labels: Record<string, string> = {
      orders: 'Live Orders',
      dispatch: 'Dispatch Board',
      'delivery-partners': 'Dispatch Fleet',
      issues: 'Exceptions',
      vendors: 'Stores',
      products: 'Vendor Products',
      catalog: 'Master Catalog',
      'catalog-requests': 'Catalog Requests',
      'vendor-variant-approvals': 'Product Approvals',
      categories: 'Categories',
      customers: 'Customers',
      coupons: 'Promotions',
      notifications: 'Notifications',
      assets: 'Assets',
      payments: 'Payments',
      payouts: 'Payouts',
      reconciliation: 'Reconciliation',
      'scheduled-tasks': 'Automation',
      'platform-settings': 'Platform Settings',
      'audit-logs': 'Audit Logs',
      'production-readiness': 'Implementation Roadmap',
      'admin-users': 'Admin Access',
      onboard: 'Onboarding',
      edit: 'Edit',
    };

    let currentUrl = '';
    parts.forEach((part, index) => {
      currentUrl += `/${part}`;
      const isId = /^[0-9a-f-]{20,}$/i.test(part) || (index > 0 && !labels[part]);
      const label = isId ? 'Profile' : (labels[part] || this.titleCase(part));
      crumbs.push({ label, url: index === parts.length - 1 ? undefined : currentUrl });
    });

    this.breadcrumbs.set(parts.length ? crumbs : [{ label: 'Command Center' }]);
  }

  private titleCase(value: string): string {
    return value.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
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
    if (window.innerWidth <= 1024) {
      this.mobileMenuOpen.update(v => !v);
      return;
    }
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


