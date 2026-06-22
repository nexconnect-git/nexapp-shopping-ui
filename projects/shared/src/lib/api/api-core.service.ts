import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-url.token';
import { ApiParams, ApiRequestOptions } from './api-types';

@Injectable({ providedIn: 'root' })
export class ApiCoreService {
  protected readonly http = inject(HttpClient);
  protected readonly baseUrl = inject(API_BASE_URL);

  protected get<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.get<T>(this.resolveUrl(path), this.options(options));
  }

  protected post<T>(
    path: string,
    body: unknown,
    options: ApiRequestOptions = {},
  ): Observable<T> {
    return this.http.post<T>(this.resolveUrl(path), body, this.options(options));
  }

  protected put<T>(
    path: string,
    body: unknown,
    options: ApiRequestOptions = {},
  ): Observable<T> {
    return this.http.put<T>(this.resolveUrl(path), body, this.options(options));
  }

  protected patch<T>(
    path: string,
    body: unknown,
    options: ApiRequestOptions = {},
  ): Observable<T> {
    return this.http.patch<T>(this.resolveUrl(path), body, this.options(options));
  }

  protected delete<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.delete<T>(this.resolveUrl(path), this.options(options));
  }

  protected toFormData(data: Record<string, unknown>): FormData {
    const form = new FormData();
    Object.entries(data || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (value instanceof File) {
        form.append(key, value);
        return;
      }
      if (Array.isArray(value) || typeof value === 'object') {
        form.append(key, JSON.stringify(value));
        return;
      }
      form.append(key, String(value));
    });
    return form;
  }

  protected resolveUrl(path: string): string {
    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const cleanPath = String(path || '').replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  private options(options: ApiRequestOptions): {
    params?: HttpParams;
    withCredentials?: boolean;
  } {
    return {
      params: this.params(options.params),
      withCredentials: options.withCredentials,
    };
  }

  private params(params?: ApiParams): HttpParams | undefined {
    if (!params) return undefined;
    if (params instanceof HttpParams) return params;
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      httpParams = httpParams.set(key, String(value));
    });
    return httpParams;
  }
}
