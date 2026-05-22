import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  CustomerApiError,
  type HttpRequestInput,
  type HttpTransport,
} from '@nexconnect/customer-api-client';
import { readApiError } from '@nexconnect/customer-core';

@Injectable({ providedIn: 'root' })
export class AngularHttpAdapter implements HttpTransport {
  private readonly http = inject(HttpClient);

  request<T>(input: HttpRequestInput): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.http
        .request<T>(input.method, input.url, {
          body: input.body,
          headers: input.headers,
        })
        .subscribe({
          next: resolve,
          error: (error: HttpErrorResponse) =>
            reject(
              new CustomerApiError(
                readApiError(error.error || error),
                error.status,
                error.error,
              ),
            ),
        });
    });
  }
}
