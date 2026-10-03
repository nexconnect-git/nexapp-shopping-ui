import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  apiErrorMessage,
  VendorOrderCommand,
  VendorOrderSnapshot,
} from '@shared/public-api';
import { VendorOrdersStore } from './vendor-orders.store';
export type VendorOrderAction = VendorOrderCommand;
@Injectable({ providedIn: 'root' })
export class VendorOrderActionsService {
  private readonly store = inject(VendorOrdersStore);
  run(
    id: string,
    action: VendorOrderCommand,
    data: Record<string, string> = {}
  ): Observable<VendorOrderSnapshot> {
    return this.store.run(id, action, data);
  }
  errorMessage(error: unknown, fallback = 'Order action failed.'): string {
    return apiErrorMessage(error, fallback);
  }
}
