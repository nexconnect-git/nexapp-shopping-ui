import { Component, computed, effect, OnInit, signal } from '@angular/core';
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
import { AppLoaderComponent } from './shared/app-loader/app-loader.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { MobileStickyCartBarComponent } from './shared/mobile-sticky-cart-bar/mobile-sticky-cart-bar.component';
import { MobileTopbarComponent } from './mobile-ui/mobile-topbar/mobile-topbar.component';
import { MobileBottomNavComponent } from './mobile-ui/mobile-bottom-nav/mobile-bottom-nav.component';
import { MobileLoaderComponent } from './mobile-ui/mobile-loader/mobile-loader.component';
import { MobileToastComponent } from './mobile-ui/mobile-toast/mobile-toast.component';
import { GlobalLoadingComponent } from '@shared/lib/components/global-loading/global-loading.component';
import { ToastComponent } from '@shared/lib/components/toast/toast.component';
import { PageFeatureLoadingComponent } from '@shared/lib/components/page-feature-loading/page-feature-loading.component';
import { UiService } from './services/ui.service';
import { CatalogService } from './services/catalog.service';
import { OrderService } from './services/order.service';
import { CustomerAppStartupService } from './services/customer-app-startup.service';

@Component({
  selector: 'fd-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    TopbarComponent,
    MobileTopbarComponent,
    LoginSliderComponent,
    MiniCartComponent,
    EditModalComponent,
    LocationModalComponent,
    FilterSliderComponent,
    AppLoaderComponent,
    ConfirmDialogComponent,
    MobileBottomNavComponent,
    MobileLoaderComponent,
    MobileToastComponent,
    MobileStickyCartBarComponent,
    GlobalLoadingComponent,
    ToastComponent,
    PageFeatureLoadingComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [CustomerAppStartupService],
})
export class AppComponent implements OnInit {
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
      url.startsWith('/categories')
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
      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.routeLoading.set(false);
      }
    });
    effect(() => {
      this.loading.set(this.routeLoading() || this.isCurrentRouteDataLoading());
    });
  }

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
