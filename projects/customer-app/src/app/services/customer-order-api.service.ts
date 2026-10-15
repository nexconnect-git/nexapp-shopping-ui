import { inject, Injectable } from '@angular/core';
import { InvoiceApi } from '@shared/lib/api/invoice-api.service';
import { CustomerApiClientService } from './customer-api-client.service';

@Injectable({ providedIn: 'root' })
export class CustomerOrderApiService {
  private readonly invoices = inject(InvoiceApi);
  private readonly api = inject(CustomerApiClientService);

  getOrders(status?: string, query?: Record<string, string | number>) {
    return this.api.toObservable<any>(
      this.api.client.orders.orders(status, query)
    );
  }

  getOrder(orderId: string) {
    return this.api.toObservable<any>(this.api.client.orders.order(orderId));
  }

  getOrderTracking(orderId: string) {
    return this.api.toObservable<any>(
      this.api.client.orders.orderTracking(orderId)
    );
  }

  reorder(orderId: string, preview = false) {
    return this.api.toObservable<any>(
      this.api.client.orders.reorder(orderId, preview)
    );
  }

  cancelOrder(orderId: string, reason = '') {
    return this.api.toObservable<any>(
      this.api.client.orders.cancelOrder(orderId, reason)
    );
  }

  submitOrderRating(orderId: string, payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.orders.submitOrderRating(orderId, payload)
    );
  }

  cancellationPolicy() {
    return this.api.toObservable<any>(
      this.api.client.checkout.cancellationPolicy()
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
