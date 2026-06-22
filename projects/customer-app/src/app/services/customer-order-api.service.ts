import { inject, Injectable } from '@angular/core';
import { InvoiceApi } from '@shared/public-api';
import { CustomerApiClientService } from './customer-api-client.service';

@Injectable({ providedIn: 'root' })
export class CustomerOrderApiService {
  private readonly invoices = inject(InvoiceApi);
  private readonly api = inject(CustomerApiClientService);

  getOrders(status?: string) {
    return this.api.toObservable<any>(this.api.client.orders.orders(status));
  }

  getOrder(orderId: string) {
    return this.api.toObservable<any>(this.api.client.orders.order(orderId));
  }

  getOrderTracking(orderId: string) {
    return this.api.toObservable<any>(
      this.api.client.orders.orderTracking(orderId),
    );
  }

  reorder(orderId: string) {
    return this.api.toObservable<any>(this.api.client.orders.reorder(orderId));
  }

  cancelOrder(orderId: string) {
    return this.api.toObservable<any>(
      this.api.client.orders.cancelOrder(orderId),
    );
  }

  submitOrderRating(orderId: string, payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.orders.submitOrderRating(orderId, payload),
    );
  }

  getCoupons() {
    return this.api.toObservable<any>(this.api.client.catalog.coupons());
  }

  downloadInvoice(invoiceId: string) {
    return this.invoices.downloadInvoice(invoiceId);
  }

  generateInvoice(payload: Record<string, any>) {
    return this.invoices.generateInvoice(payload);
  }
}
