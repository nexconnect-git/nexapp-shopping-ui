import { DOCUMENT } from '@angular/common';
import { CustomerStateComponent } from './shared/customer-state/customer-state.component';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';
import { CustomerIconComponent } from './shared/customer-icon/customer-icon.component';
import { HostListener } from '@angular/core';
import { NxModalShellComponent } from './shared/ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerCurrencyPipe } from './shared/customer-currency/customer-currency.pipe';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { TopbarComponent } from './shared/topbar/topbar.component';
import { AppStateService } from './services/app-state.service';
import { LoginSliderComponent } from './shared/login-slider/login-slider.component';
import { MiniCartComponent } from './shared/mini-cart/mini-cart.component';
import { EditModalComponent } from './shared/edit-modal/edit-modal.component';
import { LocationModalComponent } from './shared/location-modal/location-modal.component';
import { FilterSliderComponent } from './shared/filter-slider/filter-slider.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { MobileBottomNavComponent } from './mobile-ui/mobile-bottom-nav/mobile-bottom-nav.component';
import { CustomerToastComponent } from './shared/customer-toast/customer-toast.component';
import { UiService } from './services/ui.service';
import { CatalogService } from './services/catalog.service';
import { OrderService } from './services/order.service';
import { CustomerAppStartupService } from './services/customer-app-startup.service';

@Component({
  selector: 'fd-root',
  standalone: true,
  imports: [CustomerIconComponent,
    RouterOutlet,
    NxModalShellComponent,
    CustomerCurrencyPipe,
    RouterLink,
    TopbarComponent,
    LoginSliderComponent,
    MiniCartComponent,
    EditModalComponent,
    LocationModalComponent,
    FilterSliderComponent,
    ConfirmDialogComponent,
    MobileBottomNavComponent,
    CustomerToastComponent,
    CustomerStateComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [CustomerAppStartupService],
})
export class AppComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  skipToContent(event: Event): void {
    event.preventDefault();
    const content = this.document.getElementById('customer-main');
    content?.focus();
    content?.scrollIntoView({block: 'start'});
  }
  readonly auth=inject(SharedAuthService);
  readonly features=inject(PageFeatureAccessService);
  readonly bootstrapLoading=computed(()=>this.features.isLoading()&&!this.features.hasResolved());
  readonly systemVisible=computed(()=>this.offline()||!!this.auth.sessionRenewalError()||this.bootstrapLoading());
  retrySession():void {this.auth.refreshAccessToken().subscribe({error:()=>undefined});}
  retryOnline():void {this.offline.set(!navigator.onLine);if(!this.offline())this.state.retryCheckoutPreview();}
  offline = signal(!navigator.onLine);
  readonly customerDestinations = [
    { route: '/', label: 'Home', icon: 'home' },
    { route: '/stores', label: 'Stores', icon: 'store' },
    { route: '/categories', label: 'Categories', icon: 'grid' },
    { route: '/explore', label: 'Explore', icon: 'search' },
    { route: '/cart', label: 'Basket', icon: 'bag' },
    { route: '/orders', label: 'Your orders', icon: 'orders' },
    { route: '/account', label: 'Account', icon: 'user' },
    { route: '/addresses', label: 'Addresses', icon: 'pin' },
    { route: '/notifications', label: 'Notifications', icon: 'bell' },
    { route: '/privacy-policy', label: 'Privacy policy', icon: 'file' },
    { route: '/help', label: 'Help', icon: 'help' },
  ];
  @HostListener('window:online') onOnline(): void {
    this.offline.set(false);
  }
  @HostListener('window:offline') onOffline(): void {
    this.offline.set(true);
  }
  loading = signal(false);
  private routeLoading = signal(false);
  private currentUrl = signal('/');
  isHomeRoute = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    return url === '/';
  });
  showMobileTopbar = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    return !(url === '/explore' || url.startsWith('/explore/'));
  });
  showCartAssist = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    if (url === '/') return false;
    return (
      url.startsWith('/store/') ||
      url.startsWith('/product/') ||
      url.startsWith('/categories') || url.startsWith('/category/')
    );
  });
  hasUsableLocation = computed(() => {
    const location = String(this.state.location() || '').trim();
    return (
      !!this.state.activeAddress()?.id ||
      (!!location && location !== 'Select location')
    );
  });
  showActiveOrderCard = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    const cartPillVisible = this.showCartAssist() && this.state.itemCount() > 0;
    if (url !== '/') return false;
    return (
      !!this.state.activeOrder() &&
      !cartPillVisible &&
      !url.startsWith('/orders') &&
      !url.startsWith('/account') &&
      !url.startsWith('/profile') &&
      !url.startsWith('/location') &&
      !url.startsWith('/explore') &&
      !url.startsWith('/product/') &&
      !url.startsWith('/checkout') &&
      !url.startsWith('/tracking/') &&
      !url.startsWith('/order-confirmed/')
    );
  });
  hasBlockingOverlay = computed(
    () =>
      this.ui.mobileSidebarOpen() ||
      this.ui.loginSliderOpen() ||
      this.state.miniCartOpen() ||
      this.ui.miniCartOpen() ||
      this.ui.filterSliderOpen() ||
      this.ui.locationModalOpen() ||
      !!this.ui.editModal() ||
      !!this.ui.confirmDialog()
  );

  constructor(
    public state: AppStateService,
    public ui: UiService,
    private router: Router,
    private startup: CustomerAppStartupService,
    private catalog: CatalogService,
    private orders: OrderService
  ) {
    this.currentUrl.set(this.router.url || '/');
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.routeLoading.set(true);
      }
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects || event.url || '/');
        window.setTimeout(() => this.routeLoading.set(false), 150);
      }
      if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.routeLoading.set(false);
      }
    });
    effect(() => {
      this.loading.set(this.routeLoading() || this.isCurrentRouteDataLoading());
    });
  }

  private readonly scrollLock = effect((onCleanup) => {
    if (!this.hasBlockingOverlay()) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    onCleanup(() => {
      document.body.style.overflow = old;
    });
  });

  ngOnInit(): void {
    this.startup.start();
  }

  private isCurrentRouteDataLoading(): boolean {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    if (url === '/' || url === '/explore' || url.startsWith('/explore/')) {
      return (
        this.catalog.categoriesLoading() ||
        this.catalog.storesLoading() ||
        this.catalog.productsLoading()
      );
    }
    if (url.startsWith('/store/') || url.startsWith('/product/')) {
      return false;
    }
    if (url.startsWith('/categories')) {
      return false;
    }
    if (
      url.startsWith('/cart') ||
      url.startsWith('/checkout') ||
      url.startsWith('/order-confirmed/')
    ) {
      return (
        !this.state.cartLoaded() ||
        this.state.serviceabilityLoading() ||
        this.state.checkoutSubmitting()
      );
    }
    if (
      url.startsWith('/orders') ||
      url.startsWith('/tracking/') ||
      url.startsWith('/order-finished/')
    ) {
      return this.orders.loading();
    }
    return false;
  }
}
