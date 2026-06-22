import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiCoreService } from './api-core.service';

@Injectable({ providedIn: 'root' })
export class InvoiceApi extends ApiCoreService {
  generateInvoice(payload: Record<string, unknown>): Observable<any> {
    return this.post('invoices/generate/', payload);
  }

  downloadInvoice(invoiceId: string): Observable<Blob> {
    return this.http.get(this.resolveUrl(`invoices/${invoiceId}/download/`), {
      responseType: 'blob',
    });
  }

  downloadCustomerInvoice(orderId: string): Observable<Blob> {
    return this.http.get(this.resolveUrl(`invoices/orders/${orderId}/`), {
      responseType: 'blob',
    });
  }

  downloadVendorInvoice(orderId: string): Observable<Blob> {
    return this.http.get(
      this.resolveUrl(`invoices/vendor/orders/${orderId}/`),
      { responseType: 'blob' },
    );
  }
}
