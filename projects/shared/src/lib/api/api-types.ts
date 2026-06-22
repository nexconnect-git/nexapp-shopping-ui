import { HttpParams } from '@angular/common/http';

export type ApiParams =
  | HttpParams
  | Record<string, string | number | boolean | null | undefined>;

export interface ApiRequestOptions {
  params?: ApiParams;
  withCredentials?: boolean;
}
