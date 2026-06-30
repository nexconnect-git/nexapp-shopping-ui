import { inject, Injectable } from '@angular/core';
import { ApiService } from '@shared/lib/services/api.service';
import { CustomerApiClientService } from './customer-api-client.service';

@Injectable({ providedIn: 'root' })
export class CustomerCartApiService {
  private readonly sharedApi = inject(ApiService);
  private readonly api = inject(CustomerApiClientService);

  getCart() {
    return this.api.toObservable<any>(this.api.client.cart.cart());
  }

  getSuggestions() {
    return this.api.toObservable<any>(this.api.client.cart.suggestions());
  }

  getBestCoupon() {
    return this.api.toObservable<any>(this.api.client.cart.bestCoupon());
  }

  addToCart(
    productId: string,
    quantity: number,
    fulfillmentContext?: Record<string, unknown>
  ) {
    return this.api.toObservable<any>(
      this.api.client.cart.addToCart(productId, quantity, fulfillmentContext),
    );
  }

  replaceCart(
    productId: string,
    quantity: number,
    fulfillmentContext?: Record<string, unknown>
  ) {
    return this.api.toObservable<any>(
      this.api.client.cart.replaceCart(productId, quantity, fulfillmentContext),
    );
  }

  refreshFulfillmentLock(fulfillmentContext: Record<string, unknown>) {
    return this.api.toObservable<any>(
      this.api.client.cart.refreshFulfillment(fulfillmentContext),
    );
  }

  recordFulfillmentEvent(eventType: string, metadata?: Record<string, unknown>) {
    return this.api.toObservable<any>(
      this.api.client.cart.recordFulfillmentEvent(eventType, metadata),
    );
  }

  updateCartItem(itemId: string, quantity: number) {
    return this.api.toObservable<any>(
      this.api.client.cart.updateCartItem(itemId, quantity),
    );
  }

  removeCartItem(itemId: string) {
    return this.api.toObservable<void>(
      this.api.client.cart.removeCartItem(itemId),
    );
  }

  clearCart() {
    return this.api.toObservable<void>(this.api.client.cart.clearCart());
  }

  validateCoupon(code: string, subtotal: number, addressId: string | null) {
    return this.api.toObservable<any>(
      this.api.client.checkout.validateCoupon(code, subtotal, addressId),
    );
  }

  getDeliveryFeePreview(addressId: string) {
    return this.api.toObservable<any>(
      this.api.client.checkout.deliveryFeePreview(addressId),
    );
  }

  getCheckoutPreview(payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.checkout.checkoutPreview(payload),
    );
  }

  getAvailableSlots(params?: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.checkout.customerSlots(params),
    );
  }

  initiateCheckoutPayment(payload: {
    delivery_address_id: string;
    coupon_code?: string;
    wallet_amount?: number;
    confirm_far_delivery?: boolean;
    scheduled_for?: string | null;
  }) {
    return this.api.toObservable<any>(
      this.api.client.checkout.initiateCheckoutPayment(payload),
    );
  }

  createOrder(payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.checkout.createOrder(payload),
    );
  }

  setCartCount(count: number) {
    this.sharedApi.cartCount.set(count);
  }

  refreshCartCount() {
    this.sharedApi.refreshCartCount();
  }

  getOrders() {
    return this.api.toObservable<any>(this.api.client.orders.orders());
  }
}
