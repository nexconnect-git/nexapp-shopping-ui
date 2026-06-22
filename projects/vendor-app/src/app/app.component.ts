import {
  Component,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterModule,
  RouterOutlet,
} from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import {
  VendorApi,
  AuthService,
  GlobalLoadingComponent,
  PageFeatureAccessService,
  PageFeatureLoadingComponent,
  ToastComponent,
} from '@shared/public-api';
import {
  VENDOR_MOBILE_NAV_ITEMS,
  VENDOR_NAV_GROUPS,
} from './config/vendor-navigation';
import { VendorAppStartupService } from './services/vendor-app-startup.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    ToastComponent,
    GlobalLoadingComponent,
    PageFeatureLoadingComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(VendorApi);
  private router = inject(Router);
  private location = inject(Location);
  private featureAccess = inject(PageFeatureAccessService);
  private startup = inject(VendorAppStartupService);
  sidebarCollapsed = signal(true);
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<any[]>([]);
  notifLoading = signal(false);
  unreadCount = this.startup.unreadCount;
  currentUrl = signal('/');
  readonly navGroups = VENDOR_NAV_GROUPS;
  readonly mobileNavItems = VENDOR_MOBILE_NAV_ITEMS;

  constructor() {
    this.currentUrl.set(this.router.url || '/');
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects || event.url || '/');
      }
    });
  }

  ngOnInit() {
    this.startup.start();
  }

  toggleProfile(event?: Event) {
    event?.stopPropagation();
    this.profileOpen.update((v) => !v);
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
      next: (r) => {
        this.notifications.set((r.results || r).slice(0, 8));
        this.notifLoading.set(false);
      },
      error: () => this.notifLoading.set(false),
    });
  }

  markAllRead() {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update((list) =>
          list.map((n: any) => ({ ...n, is_read: true })),
        );
      },
      error: () => {},
    });
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.profileOpen.set(false);
    this.notifOpen.set(false);
  }

  closeProfile() {
    this.profileOpen.set(false);
  }

  isAuthRoute(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    const standaloneRoutes = [
      '/login',
      '/register',
      '/change-password',
      '/pending-approval',
    ];
    return standaloneRoutes.some((route) => url.startsWith(route));
  }

  isPendingRoute(): boolean {
    return this.router.url.includes('/pending-approval');
  }

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }

  closeMobileSidebar() {
    this.sidebarCollapsed.set(true);
  }

  visibleNavGroups() {
    return this.navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          this.featureAccess.isRouteEnabled('vendor-app', item.route),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }

  visibleMobileNavItems() {
    return this.mobileNavItems.filter((item) =>
      this.featureAccess.isRouteEnabled('vendor-app', item.route),
    );
  }

  canUseRoute(route: string): boolean {
    return this.featureAccess.isRouteEnabled('vendor-app', route);
  }

  storeName(): string {
    const username = this.auth.user()?.username || 'Vendor';
    return `${username}'s Store`;
  }

  userInitials(): string {
    const user = this.auth.user();
    const initials =
      `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.trim();
    return initials || user?.username?.[0]?.toUpperCase() || '?';
  }

  showBackButton(): boolean {
    const path = this.currentUrl().split('?')[0].split('#')[0];
    return !this.isAuthRoute() && path !== '/' && path !== '';
  }

  goBack(): void {
    if (!this.showBackButton()) return;
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/']);
  }

  breadcrumbs(): Array<{ label: string; url?: string }> {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];
    if (!cleanUrl || cleanUrl === '/') return [{ label: 'Dashboard' }];

    const segments = cleanUrl.split('/').filter(Boolean);
    if (segments[0] === 'products' && segments[2] === 'edit') {
      return [
        { label: 'Dashboard', url: '/' },
        { label: 'Products', url: '/products' },
        { label: this.productBreadcrumbName(segments[1]) },
      ];
    }
    if (segments[0] === 'products' && segments[1] === 'edit' && segments[2]) {
      return [
        { label: 'Dashboard', url: '/' },
        { label: 'Products', url: '/products' },
        { label: this.productBreadcrumbName(segments[2]) },
      ];
    }
    const crumbs: Array<{ label: string; url?: string }> = [
      { label: 'Dashboard', url: '/' },
    ];

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
        ? previous === 'orders'
          ? 'Order Detail'
          : 'Detail'
        : labelMap[segment] || this.titleCase(segment);
      const isIntermediateAction =
        segment === 'edit' || segment === 'new' || isUuid;
      crumbs.push({
        label,
        url:
          index === segments.length - 1 || isIntermediateAction
            ? undefined
            : url,
      });
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
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private productBreadcrumbName(id: string): string {
    return localStorage.getItem(`vendor_product_name_${id}`) || 'Product';
  }

  handleNotificationClick(n: any) {
    if (!n.is_read) {
      this.api.markNotificationRead(n.id).subscribe({
        next: () => {
          this.unreadCount.update((c) => Math.max(0, c - 1));
          this.notifications.update((list) =>
            list.map((item) =>
              item.id === n.id ? { ...item, is_read: true } : item,
            ),
          );
        },
      });
    }
    this.notifOpen.set(false);
    if (
      n.notification_type === 'order' &&
      (n.data?.order_id || n.related_entity_id)
    ) {
      this.router.navigate([
        '/orders',
        n.data?.order_id || n.related_entity_id,
      ]);
    } else {
      this.router.navigate(['/']);
    }
  }

  logout() {
    this.auth.logout();
  }
}
