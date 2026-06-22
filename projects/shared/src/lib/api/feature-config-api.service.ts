import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-url.token';

@Injectable({ providedIn: 'root' })
export class FeatureConfigApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getPageFeatureConfig(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/page-features/`);
  }
}
