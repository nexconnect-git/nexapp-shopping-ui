import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import {
  createCustomerApiClient,
  type CustomerApiClientOptions,
} from '@nexconnect/customer-api-client';
import { API_BASE_URL } from '@shared/lib/tokens/api-url.token';
import { AngularHttpAdapter } from './adapters/angular-http.adapter';
import { BrowserTokenStorageAdapter } from './adapters/browser-token-storage.adapter';

@Injectable({ providedIn: 'root' })
export class CustomerApiClientService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly tokenStorage = inject(BrowserTokenStorageAdapter);
  private readonly transport = inject(AngularHttpAdapter);

  readonly client = createCustomerApiClient({
    config: { apiBaseUrl: this.baseUrl },
    tokenStorage: this.tokenStorage,
    transport: this.transport,
  } satisfies CustomerApiClientOptions);

  toObservable<T>(promise: Promise<T>): Observable<T> {
    return from(promise);
  }
}
