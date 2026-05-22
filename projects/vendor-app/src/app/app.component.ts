import {
  Component,
  DestroyRef,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterModule,
  RouterOutlet,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  ApiService,
  AuthService,
  CurrencyService,
  GlobalLoadingComponent,
  NotificationPollingService,
  PageFeatureAccessService,
  PageFeatureLoadingComponent,
  ToastComponent,
} from '@shared/public-api';

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
  api = inject(ApiService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private notifPolling = inject(NotificationPollingService);
  private currency = inject(CurrencyService);
  private featureAccess = inject(PageFeatureAccessService);
  sidebarCollapsed = signal(true);
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<any[]>([]);
  notifLoading = signal(false);
  unreadCount = signal(0);
  private pollingStarted = false;
  private currencyConfiguredForUserId = '';
  readonly navGroups = [
    {
      label: 'Operate',
      items: [
        {
          label: 'Dashboard',
          icon: 'space_dashboard',
          route: '/',
          exact: true,
        },
        { label: 'Live Orders', icon: 'view_kanban', route: '/live-orders' },
        { label: 'Inventory', icon: 'inventory', route: '/inventory' },
      ],
    },
    {
      label: 'Catalog',
      items: [
        { label: 'Products', icon: 'inventory_2', route: '/products' },
        {
          label: 'Catalog Requests',
          icon: 'playlist_add',
          route: '/catalog-requests',
        },
        { label: 'Orders', icon: 'receipt_long', route: '/orders' },
        {
          label: 'Promotions',
          icon: 'confirmation_number',
          route: '/promotions',
        },
      ],
    },
    {
      label: 'Growth',
      items: [
        { label: 'Analytics', icon: 'monitoring', route: '/analytics' },
        { label: 'Payouts', icon: 'payments', route: '/payouts' },
        { label: 'Reviews', icon: 'reviews', route: '/reviews' },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Support', icon: 'support_agent', route: '/support' },
        {
          label: 'Notifications',
          icon: 'notifications',
          route: '/notifications',
        },
        {
          label: 'Store Settings',
          icon: 'manage_accounts',
          route: '/store-settings',
        },
      ],
    },
  ];
  readonly mobileNavItems = [
    { label: 'Home', icon: 'space_dashboard', route: '/', exact: true },
    { label: 'Orders', icon: 'view_kanban', route: '/live-orders' },
    { label: 'Stock', icon: 'inventory', route: '/inventory' },
    { label: 'Inbox', icon: 'notifications', route: '/notifications' },
    { label: 'Store', icon: 'settings', route: '/store-settings' },
  ];

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.startPolling();
        const userId = this.auth.user()?.id || 'vendor';
        if (this.currencyConfiguredForUserId !== userId) {
          this.currencyConfiguredForUserId = userId;
          this.configureVendorCurrency();
        }
      } else if (this.pollingStarted) {
        this.notifPolling.stop();
        this.pollingStarted = false;
        this.currencyConfiguredForUserId = '';
        this.unreadCount.set(0);
        this.notifications.set([]);
      }
    });
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.startPolling();
      this.configureVendorCurrency();
    }
    this.featureAccess.startPolling('vendor-app');
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

  private configureVendorCurrency() {
    this.api.getVendorProfile().subscribe({
      next: (vendor) => {
        this.currency.configureFromLocation({
          country:
            vendor?.country ||
            vendor?.country_code ||
            vendor?.user_info?.country,
          latitude: vendor?.latitude,
          longitude: vendor?.longitude,
          address: vendor?.address,
          city: vendor?.city,
          state: vendor?.state,
          postalCode: vendor?.postal_code,
          name: vendor?.store_name,
        });
      },
      error: () => {
        const userCountry = this.auth.user()?.country;
        if (userCountry)
          this.currency.configureFromLocation({ country: userCountry });
      },
    });
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
