import { inject, Injectable } from '@angular/core';
import { AppStateService } from '../app-state.service';

@Injectable({ providedIn: 'root' })
export class CustomerCheckoutFacade {
  private readonly state = inject(AppStateService);

  readonly selectedPaymentMethod = this.state.selectedPaymentMethod;
  readonly checkoutSubmitting = this.state.checkoutSubmitting;
  readonly lastCheckoutError = this.state.lastCheckoutError;
  readonly deliveryFeePreview = this.state.deliveryFeePreview;
  readonly checkoutPriceBreakup = this.state.checkoutPriceBreakup;
  readonly requiresFarDeliveryConfirmation =
    this.state.requiresFarDeliveryConfirmation;

  selectPayment(id: string): void {
    this.state.selectPayment(id);
  }

  placeOrder(
    options?: Parameters<AppStateService['placeOrder']>[0],
  ): ReturnType<AppStateService['placeOrder']> {
    return this.state.placeOrder(options);
  }

  getCheckoutPreview(
    options?: Parameters<AppStateService['getCheckoutPreview']>[0],
  ): ReturnType<AppStateService['getCheckoutPreview']> {
    return this.state.getCheckoutPreview(options);
  }
}
