import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';
import { ApiService, type Order } from '@shared/public-api';

export type VendorOrderAction =
  | 'accept'
  | 'reject'
  | 'start_preparing'
  | 'mark_ready'
  | 'start_delivery_search'
  | 'cancel_delivery_search'
  | 'verify_pickup_otp'
  | 'cancel_order'
  | 'set_status';

@Injectable({ providedIn: 'root' })
export class VendorOrderActionsService {
  private api = inject(ApiService);

  run(
    orderId: string,
    action: VendorOrderAction,
    data: Record<string, any> = {},
  ): Observable<Order> {
    switch (action) {
      case 'accept':
        return this.api.acceptVendorOrder(orderId);
      case 'reject':
        return this.api.rejectVendorOrder(orderId, data['reason'] || '');
      case 'start_preparing':
        return this.api.startPreparingVendorOrder(orderId);
      case 'mark_ready':
        return this.api.markVendorOrderReady(orderId);
      case 'start_delivery_search':
        return this.api.startDeliverySearch(orderId);
      case 'cancel_delivery_search':
        return this.api.cancelDeliverySearch(orderId);
      case 'verify_pickup_otp':
        return this.api.verifyPickupOtp(orderId, data['otp'] || '');
      case 'cancel_order':
        return this.api.updateOrderStatus(
          orderId,
          'cancelled',
          data['reason'] || '',
        );
      case 'set_status':
        return this.api.updateOrderStatus(orderId, data['status']);
    }
  }

  errorMessage(error: any, fallback = 'Order action failed.'): string {
    return error?.error?.error || error?.error?.detail || fallback;
  }
}
