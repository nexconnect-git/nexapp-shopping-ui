import { effect, inject, Injectable } from '@angular/core';
import { CurrencyService, PageFeatureAccessService } from '@shared/public-api';
import { VendorContextService } from './vendor-context.service';
@Injectable({ providedIn: 'root' })
export class VendorAppStartupService {
  private readonly features = inject(PageFeatureAccessService);
  private readonly context = inject(VendorContextService);
  private readonly currency = inject(CurrencyService);
  private started = false;
  constructor() {
    effect(() => {
      const context = this.context.context();
      if (context)
        this.currency.configureFromLocation({
          ...context.vendor,
          postalCode: context.vendor.postal_code,
          country: context.vendor.user_info.country,
        });
    });
  }
  start(): void {
    if (this.started) return;
    this.started = true;
    this.features.startPolling('vendor-app');
  }
}
