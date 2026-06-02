import {
  Component,
  computed,
  effect,
  OnInit,
  signal,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
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
import { AppLoaderService } from './shared/app-loader/app-loader.service';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { MobileStickyCartBarComponent } from './shared/mobile-sticky-cart-bar/mobile-sticky-cart-bar.component';
import { MobileTopbarComponent } from './mobile-ui/mobile-topbar/mobile-topbar.component';
import { MobileBottomNavComponent } from './mobile-ui/mobile-bottom-nav/mobile-bottom-nav.component';
import { MobileLoaderComponent } from './mobile-ui/mobile-loader/mobile-loader.component';
import { MobileToastComponent } from './mobile-ui/mobile-toast/mobile-toast.component';
import { ApiService } from '@shared/lib/services/api.service';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { GlobalLoadingComponent } from '@shared/lib/components/global-loading/global-loading.component';
import { NotificationPollingService } from '@shared/lib/services/notification-polling.service';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';
import { PageFeatureLoadingComponent } from '@shared/lib/components/page-feature-loading/page-feature-loading.component';
import { UiService } from './services/ui.service';
import { CustomerContentConfigService } from './services/customer-content-config.service';

@Component({
  selector: 'fd-root',
  standalone: true,
  imports: [
    RouterOutlet,
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
    PageFeatureLoadingComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [AppLoaderService],
})
export class AppComponent implements OnInit {
  loading = signal(false);
  private currentUrl = signal('/');
  isHomeRoute = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    return url === '/' || url === '/new-home';
  });
  showCartAssist = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    if (url === '/' || url === '/new-home') return true;
    return (
      url.startsWith('/stores') ||
      url.startsWith('/store/') ||
      url.startsWith('/category') ||
      url.startsWith('/categories') ||
      url.startsWith('/search')
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
      !!this.ui.confirmDialog(),
  );

  constructor(
    public state: AppStateService,
    public ui: UiService,
    private router: Router,
    private loader: AppLoaderService,
    private features: PageFeatureAccessService,
    private content: CustomerContentConfigService,
    private sharedAuth: SharedAuthService,
    private notifications: NotificationPollingService,
    private api: ApiService,
  ) {
    this.currentUrl.set(this.router.url || '/');
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.loading.set(true);
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects || event.url || '/');
        this.loading.set(false);
      }
      if (event instanceof NavigationCancel || event instanceof NavigationError)
        this.loading.set(false);
    });
    effect(() => {
      if (this.sharedAuth.isLoggedIn()) {
        this.notifications.start();
        this.api.refreshUnreadCount();
      } else {
        this.notifications.stop();
      }
    });
  }

  ngOnInit(): void {
    this.content.load();
    window.setTimeout(() => this.loader.hide(), 700);
    this.features.startPolling('customer-app');
  }
}
