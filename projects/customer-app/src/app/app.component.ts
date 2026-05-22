import { Component, OnInit, signal } from '@angular/core';
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
import { MobileBottomNavComponent } from './shared/mobile-bottom-nav/mobile-bottom-nav.component';
import { MobileStickyCartBarComponent } from './shared/mobile-sticky-cart-bar/mobile-sticky-cart-bar.component';
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
    LoginSliderComponent,
    MiniCartComponent,
    EditModalComponent,
    LocationModalComponent,
    FilterSliderComponent,
    AppLoaderComponent,
    ConfirmDialogComponent,
    MobileBottomNavComponent,
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
  currentUrl = signal('/');
  readonly isFlashHome = () => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    return url === '/' || url === '/new-home';
  };

  constructor(
    public state: AppStateService,
    public ui: UiService,
    router: Router,
    private loader: AppLoaderService,
    private features: PageFeatureAccessService,
    private content: CustomerContentConfigService,
  ) {
    this.currentUrl.set(router.url || '/');
    router.events.subscribe((event) => {
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
