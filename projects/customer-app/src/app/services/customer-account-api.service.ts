import { inject, Injectable } from '@angular/core';
import { CustomerApiClientService } from './customer-api-client.service';

@Injectable({ providedIn: 'root' })
export class CustomerAccountApiService {
  private api = inject(CustomerApiClientService);

  getAddresses() {
    return this.api.toObservable<any>(this.api.client.account.addresses());
  }

  createAddress(payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.account.createAddress(payload),
    );
  }

  updateAddress(addressId: string, payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.account.updateAddress(addressId, payload),
    );
  }

  deleteAddress(addressId: string) {
    return this.api.toObservable<void>(
      this.api.client.account.deleteAddress(addressId),
    );
  }

  getPaymentMethods() {
    return this.api.toObservable<any>(
      this.api.client.checkout.paymentMethods(),
    );
  }
}
