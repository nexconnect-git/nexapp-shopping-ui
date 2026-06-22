import { effect, Injectable } from '@angular/core';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { NativePlatformService } from '@shared/lib/services/native-platform.service';
import { NotificationPollingService } from '@shared/lib/services/notification-polling.service';
import { PageFeatureAccessService } from '@shared/lib/services/page-feature-access.service';
import { AppLoaderService } from '../shared/app-loader/app-loader.service';
import { CustomerContentConfigService } from './customer-content-config.service';

@Injectable()
export class CustomerAppStartupService {
  private initialLoadersHidden = false;

  constructor(
    private readonly content: CustomerContentConfigService,
    private readonly features: PageFeatureAccessService,
    private readonly auth: SharedAuthService,
    private readonly notifications: NotificationPollingService,
    private readonly nativePlatform: NativePlatformService,
    private readonly loader: AppLoaderService,
  ) {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.notifications.start();
        return;
      }
      this.notifications.stop();
    });
  }

  start(): void {
    this.content.load();
    this.features.loadConfig(!this.features.hasResolved()).subscribe({
      complete: () => this.hideInitialLoaders(),
    });
    this.features.startPolling('customer-app');
    window.setTimeout(() => this.hideInitialLoaders(), 8000);
  }

  private hideInitialLoaders(): void {
    if (this.initialLoadersHidden) return;
    this.initialLoadersHidden = true;
    window.setTimeout(() => {
      this.loader.hide();
      void this.nativePlatform.hideSplashScreen();
    }, 700);
  }
}
