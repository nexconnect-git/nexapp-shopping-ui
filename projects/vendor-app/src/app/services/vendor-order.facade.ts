import { inject, Injectable } from '@angular/core';
import { switchMap } from 'rxjs';
import { VendorApi, Order } from '@shared/public-api';

@Injectable({ providedIn: 'root' })
export class VendorOrderFacade {
  private readonly api = inject(VendorApi);

  loadOrder(orderId: string) {
    return this.api.getVendorOrder(orderId);
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
