import { effect, Injectable, signal } from '@angular/core';
import {
  AuthService,
  CurrencyService,
  NotificationPollingService,
  PageFeatureAccessService,
  VendorApi,
} from '@shared/public-api';

@Injectable({ providedIn: 'root' })
export class VendorAppStartupService {
  readonly unreadCount = signal(0);

  private started = false;
  private currencyConfiguredForUserId = '';

  constructor(
    private readonly auth: AuthService,
    private readonly api: VendorApi,
    private readonly currency: CurrencyService,
    private readonly notifications: NotificationPollingService,
    private readonly features: PageFeatureAccessService,
  ) {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.startNotificationPolling();
        this.configureCurrencyForUser();
        return;
      }
      this.notifications.stop();
      this.currencyConfiguredForUserId = '';
      this.unreadCount.set(0);
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.notifications.onUnreadChange((count) => this.unreadCount.set(count));
    if (this.auth.isLoggedIn()) {
      this.startNotificationPolling();
      this.configureCurrencyForUser();
    }
    this.features.startPolling('vendor-app');
  }

  private startNotificationPolling(): void {
    this.notifications.start((notification) => {
      if (notification.notification_type === 'order' && notification.related_entity_id) {
        return { label: 'View', url: `/orders/${notification.related_entity_id}` };
      }
      if (notification.notification_type === 'order' && notification.data?.order_id) {
        return { label: 'View', url: `/orders/${notification.data.order_id}` };
      }
      return null;
    });
  }

  private configureCurrencyForUser(): void {
    const userId = this.auth.user()?.id || 'vendor';
    if (this.currencyConfiguredForUserId === userId) return;
    this.currencyConfiguredForUserId = userId;
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
        if (userCountry) this.currency.configureFromLocation({ country: userCountry });
      },
    });
  }
}
