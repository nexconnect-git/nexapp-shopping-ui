import { effect, Injectable, signal } from '@angular/core';
import {
  AuthService,
  NativePlatformService,
  NotificationPollingService,
  NotificationStateService,
  PageFeatureAccessService,
} from '@shared/public-api';

@Injectable({ providedIn: 'root' })
export class DeliveryAppStartupService {
  readonly unreadCount = signal(0);

  private started = false;
  private splashHidden = false;

  constructor(
    private readonly auth: AuthService,
    private readonly notifications: NotificationPollingService,
    private readonly notificationState: NotificationStateService,
    private readonly features: PageFeatureAccessService,
    private readonly nativePlatform: NativePlatformService,
  ) {
    effect(
      () => {
        if (!this.auth.isLoggedIn()) {
          this.notifications.stop();
          this.notificationState.unreadNotifications.set(0);
          this.unreadCount.set(0);
          return;
        }
        this.notifications.start();
      },
      { allowSignalWrites: true },
    );
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.notifications.onUnreadChange((count) => this.unreadCount.set(count));
    this.features.loadConfig(!this.features.hasResolved()).subscribe({
      complete: () => this.hideInitialSplash(),
    });
    this.features.startPolling('delivery-app');
    window.setTimeout(() => this.hideInitialSplash(), 8000);
  }

  private hideInitialSplash(): void {
    if (this.splashHidden) return;
    this.splashHidden = true;
    window.setTimeout(() => void this.nativePlatform.hideSplashScreen(), 700);
  }
}
