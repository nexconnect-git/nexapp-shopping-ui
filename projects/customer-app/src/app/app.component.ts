import { Component, computed, OnInit, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { TopbarComponent } from './shared/topbar/topbar.component';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
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
import {
  GlobalLoadingComponent,
  PageFeatureAccessService,
  PageFeatureLoadingComponent,
} from '@shared/public-api';
import { UiService } from './services/ui.service';
import { CustomerContentConfigService } from './services/customer-content-config.service';

@Component({
  selector: 'fd-root',
  standalone: true,
  imports: [
    RouterOutlet,
    TopbarComponent,
    SidebarComponent,
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
    return (
      this.isHomeRoute() ||
      url === '/stores' ||
      url === '/search' ||
      url.startsWith('/store/') ||
      url.startsWith('/product/') ||
      url.startsWith('/category/')
    );
  });

  constructor(
    public state: AppStateService,
    public ui: UiService,
    private router: Router,
    private loader: AppLoaderService,
    private features: PageFeatureAccessService,
    private content: CustomerContentConfigService,
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
  }

  ngOnInit(): void {
    this.content.load();
    window.setTimeout(() => this.loader.hide(), 700);
    this.features.startPolling('customer-app');
  }
}
