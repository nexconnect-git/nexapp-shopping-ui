import { inject, Injectable } from '@angular/core';
import { switchMap } from 'rxjs';
import { Order, VendorApi } from '@shared/public-api';
import { VendorOrdersStore } from './vendor-orders.store';

@Injectable({ providedIn: 'root' })
export class VendorOrderFacade {
  private readonly api = inject(VendorApi);
  private readonly store = inject(VendorOrdersStore);

  loadOrder(orderId: string) {
    return this.store.fetch(orderId);
  }

  downloadCustomerInvoice(order: Order) {
    return this.api
      .generateInvoice({
        invoice_type: 'customer_receipt',
        order: order.id,
        amount: order.total,
        notes: `Receipt for Order #${order.order_number}`,
      })
      .pipe(switchMap((invoice) => this.api.downloadInvoice(invoice.id)));
  }
}
