import { EMPTY, expand, reduce, map } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import { CustomerApiClientService } from './customer-api-client.service';

@Injectable({ providedIn: 'root' })
export class CustomerAccountApiService {
  private api = inject(CustomerApiClientService);

  getProfile() {
    return this.api.toObservable<any>(this.api.client.auth.profile());
  }

  updateProfile(payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.auth.updateProfile(payload)
    );
  }

  getAddresses() {
    const page = (number: number) =>
      this.api
        .toObservable<any>(this.api.client.account.addresses({ page: number }))
        .pipe(map((response) => ({ response, number })));
    return page(1).pipe(
      expand(({ response, number }) =>
        response.next ? page(number + 1) : EMPTY
      ),
      reduce(
        (items: any[], { response }) => [
          ...items,
          ...(Array.isArray(response) ? response : response.results || []),
        ],
        []
      )
    );
  }

  createAddress(payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.account.createAddress(payload)
    );
  }

  updateAddress(addressId: string, payload: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.account.updateAddress(addressId, payload)
    );
  }

  deleteAddress(addressId: string) {
    return this.api.toObservable<void>(
      this.api.client.account.deleteAddress(addressId)
    );
  }

  makeDefaultAddress(addressId: string) {
    return this.api.toObservable<any>(
      this.api.client.account.patchAddress(addressId, { is_default: true })
    );
  }

  getPaymentMethods() {
    return this.api.toObservable<any>(
      this.api.client.checkout.paymentMethods()
    );
  }
}
