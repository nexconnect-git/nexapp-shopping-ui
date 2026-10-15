import {
  Component,
  DestroyRef,
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
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VendorContextService } from './services/vendor-context.service';
import { VendorInboxService } from './services/vendor-inbox.service';
import { Notification } from '@shared/public-api';
import { CommonModule } from '@angular/common';
import {
  AuthService,
  PageFeatureAccessService,
  PageFeatureLoadingComponent,
  ToastComponent,
} from '@shared/public-api';
import {
  VENDOR_MOBILE_NAV_ITEMS,
  VENDOR_NAV_GROUPS,
} from './config/vendor-navigation';
import { VendorLeaveService } from './services/vendor-leave.service';
import { WorkspaceDialogComponent } from './components/workspace-dialog.component';
import { OperatingStatusComponent } from './components/operating-status.component';
import { VendorAppStartupService } from './services/vendor-app-startup.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    WorkspaceDialogComponent,
    OperatingStatusComponent,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    ToastComponent,
    PageFeatureLoadingComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly leave = inject(VendorLeaveService);
  auth = inject(AuthService);
  private router = inject(Router);
  private featureAccess = inject(PageFeatureAccessService);
  private startup = inject(VendorAppStartupService);
  readonly store = inject(VendorContextService);
  readonly inbox = inject(VendorInboxService);
  private destroy = inject(DestroyRef);
  readonly exploreOpen = signal(false);
  readonly operatingOpen = signal(false);
  readonly closingStore = signal(false);
  readonly counterNav = [
    { label: 'Today', route: '/', prefix: '/', exact: true },
    { label: 'Orders', route: '/live-orders', prefix: '/orders' },
    { label: 'Catalog', route: '/products', prefix: '/products' },
    { label: 'Money', route: '/payouts', prefix: '/payouts' },
    { label: 'Growth', route: '/analytics', prefix: '/analytics' },
    { label: 'Store', route: '/store-settings', prefix: '/store-settings' },
  ];
  visibleCounterNav() {
    return this.counterNav.filter(item => this.featureAccess.isRouteEnabled('vendor-app', item.route));
  }
  navActive(route: string): boolean {
    const path = this.currentUrl().split('?')[0];
    const families: Record<string, string[]> = {
      '/': ['/'], '/live-orders': ['/live-orders', '/orders'],
      '/products': ['/products', '/inventory', '/catalog-requests'],
      '/payouts': ['/payouts', '/transactions'], '/analytics': ['/analytics', '/promotions', '/reviews'],
      '/store-settings': ['/store-settings', '/support', '/notifications'],
    };
    return (families[route] || [route]).some(prefix => prefix === '/' ? path === '/' : path.startsWith(prefix));
  }
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = this.inbox.preview;
  notifLoading = this.inbox.loading;
  unreadCount = this.inbox.unread;
  currentUrl = signal('/');
  readonly navGroups = VENDOR_NAV_GROUPS;
  readonly mobileNavItems = VENDOR_MOBILE_NAV_ITEMS;

  constructor() {
    this.currentUrl.set(this.router.url || '/');
    this.router.events
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.currentUrl.set(event.urlAfterRedirects || event.url || '/');
          this.closeDropdowns();
          this.exploreOpen.set(false);
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
    if (opening) this.inbox.refreshPreview();
  }

  fetchNotifications() {
    this.inbox.refreshPreview();
  }
  markAllRead() {
    this.inbox.markAllRead();
  }

  closeDropdowns(event?: MouseEvent) {
    if (
      (event?.target as HTMLElement | null)?.closest(
        '.notif-wrapper,.profile-menu-wrapper'
      )
    )
      return;
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
      '/forgot-password',
      '/reset-password',
      '/change-password',
      '/pending-approval',
    ];
    return standaloneRoutes.some((route) => url.startsWith(route));
  }

  isPendingRoute(): boolean {
    return this.router.url.includes('/pending-approval');
  }

  visibleNavGroups() {
    return this.navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          this.featureAccess.isRouteEnabled('vendor-app', item.route)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }

  visibleMobileNavItems() {
    return this.mobileNavItems.filter((item) =>
      this.featureAccess.isRouteEnabled('vendor-app', item.route)
    );
  }

  storeName(): string {
    return this.store.context()?.vendor.store_name || 'Vendor workspace';
  }

  userInitials(): string {
    const user = this.auth.user();
    const initials = `${user?.first_name?.[0] || ''}${
      user?.last_name?.[0] || ''
    }`.trim();
    return initials || user?.username?.[0]?.toUpperCase() || '?';
  }

  breadcrumbs(): Array<{ label: string; url?: string }> {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];
    if (!cleanUrl || cleanUrl === '/') return [{ label: 'Today' }];

    const segments = cleanUrl.split('/').filter(Boolean);
    if (segments[0] === 'products' && segments[2] === 'edit') {
      return [
        { label: 'Today', url: '/' },
        { label: 'Products', url: '/products' },
        { label: this.productBreadcrumbName(segments[1]) },
      ];
    }
    if (segments[0] === 'products' && segments[1] === 'edit' && segments[2]) {
      return [
        { label: 'Today', url: '/' },
        { label: 'Products', url: '/products' },
        { label: this.productBreadcrumbName(segments[2]) },
      ];
    }
    const crumbs: Array<{ label: string; url?: string }> = [
      { label: 'Today', url: '/' },
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
      transactions: 'Transactions',
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

  private titleCase(value: string): string {
    return value
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private productBreadcrumbName(id: string): string {
    return localStorage.getItem(`vendor_product_name_${id}`) || 'Product';
  }

  handleNotificationClick(notification: Notification) {
    this.inbox.markRead(notification);
    this.notifOpen.set(false);
    void this.router.navigateByUrl(this.inbox.destination(notification));
  }

  @HostListener('document:keydown.escape')
  closeOverlays(): void {
    this.closeDropdowns();
  }

  logout() {
    this.auth.logout();
  }
}
