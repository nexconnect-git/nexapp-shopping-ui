import {
  HttpContextToken,
  type HttpEvent,
  type HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of, tap, shareReplay, finalize } from 'rxjs';

export const SKIP_HTTP_CACHE = new HttpContextToken<boolean>(() => false);

type CacheEntry = {
  expiresAt: number;
  response?: HttpResponse<unknown>;
  request$?: Observable<HttpEvent<unknown>>;
};

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 160;

const PUBLIC_READ_PATTERNS = [
  /\/api\/vendors\/list\/?(\?|$)/,
  /\/api\/vendors\/[0-9a-f-]+\/?(\?|$)/,
  /\/api\/vendors\/[0-9a-f-]+\/recommendations\/?(\?|$)/,
  /\/api\/products\/categories\/?(\?|$)/,
  /\/api\/products\/list\/?(\?|$)/,
  /\/api\/products\/featured\/?(\?|$)/,
  /\/api\/products\/[0-9a-f-]+\/?(\?|$)/,
  /\/api\/orders\/banners\/?(\?|$)/,
  /\/api\/orders\/coupons\/?(\?|$)/,
  /\/api\/orders\/cancellation-policy\/?(\?|$)/,
  /\/api\/orders\/payment-methods\/?(\?|$)/,
  /\/api\/orders\/issues\/options\/?(\?|$)/,
];

const APP_REFERENCE_PATTERNS = [
  /\/api\/auth\/setup\/?(\?|$)/,
  /\/api\/vendors\/categories\/?(\?|$)/,
  /\/api\/vendors\/catalog-products\/available\/?(\?|$)/,
  /\/api\/vendors\/catalog-products\/available\/[0-9a-f-]+\/?(\?|$)/,
  /\/api\/products\/[0-9a-f-]+\/images\/?(\?|$)/,
  /\/api\/admin\/banners\/?(\?|$)/,
  /\/api\/admin\/coupons\/?(\?|$)/,
  /\/api\/admin\/page-features\/?(\?|$)/,
];

const SHORT_LIVED_PATTERNS = [
  /\/api\/admin\/vendors\/?(\?|$)/,
  /\/api\/admin\/vendors\/[0-9a-f-]+\/?(\?|$)/,
  /\/api\/admin\/products\/?(\?|$)/,
  /\/api\/admin\/customers\/?(\?|$)/,
  /\/api\/admin\/delivery-partners\/?(\?|$)/,
  /\/api\/admin\/stats\/?(\?|$)/,
  /\/api\/vendors\/products\/?(\?|$)/,
  /\/api\/vendors\/products\/[0-9a-f-]+\/?(\?|$)/,
  /\/api\/vendors\/inherited-products\/?(\?|$)/,
  /\/api\/vendors\/catalog-proposals\/?(\?|$)/,
  /\/api\/files\/?(\?|$)/,
];

const NEVER_CACHE_PATTERNS = [
  /\/api\/auth\/profile\/?(\?|$)/,
  /\/api\/auth\/addresses\/?/,
  /\/api\/auth\/wallet\/?(\?|$)/,
  /\/api\/auth\/loyalty\/?(\?|$)/,
  /\/api\/orders\/cart\/?/,
  /\/api\/orders\/list\/?/,
  /\/api\/orders\/[0-9a-f-]+\/?/,
  /\/api\/notifications\/?/,
  /\/api\/support\/?/,
  /\/api\/vendors\/dashboard\/?/,
  /\/api\/vendors\/analytics\/?/,
  /\/api\/vendors\/operations\/summary\/?/,
  /\/api\/vendors\/orders\/?/,
  /\/api\/vendors\/live-orders\/?/,
  /\/api\/vendors\/wallet\/?/,
  /\/api\/vendors\/payouts\/?/,
  /\/api\/delivery\/dashboard\/?/,
  /\/api\/delivery\/available-orders\/?/,
  /\/api\/delivery\/history\/?/,
  /\/api\/delivery\/earnings\/?/,
  /\/api\/delivery\/requests\/?/,
  /\/api\/invoices\/?/,
];

export function clearHttpCache(): void {
  cache.clear();
}

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    clearHttpCache();
    return next(req);
  }

  const ttlMs = ttlFor(req.urlWithParams);
  if (
    ttlMs <= 0 ||
    req.context.get(SKIP_HTTP_CACHE) ||
    req.responseType !== 'json' ||
    req.headers.get('Cache-Control') === 'no-cache'
  ) {
    return next(req);
  }

  const now = Date.now();
  pruneExpired(now);
  const key = cacheKey(req.urlWithParams, req.headers.get('Authorization'));
  const cached = cache.get(key);

  if (cached?.response && cached.expiresAt > now) {
    return of(cached.response.clone());
  }

  if (cached?.request$ && cached.expiresAt > now) {
    return cached.request$;
  }

  const request$ = next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.status >= 200 && event.status < 300) {
        cache.set(key, {
          expiresAt: Date.now() + ttlMs,
          response: event.clone(),
        });
        trimCache();
      }
    }),
    finalize(() => {
      const entry = cache.get(key);
      if (entry?.request$ && !entry.response) cache.delete(key);
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  cache.set(key, { expiresAt: now + ttlMs, request$ });
  trimCache();
  return request$;
};

function ttlFor(url: string): number {
  const path = normalizedPath(url);
  if (!path.startsWith('/api/')) return 0;
  if (NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(path))) return 0;
  if (PUBLIC_READ_PATTERNS.some((pattern) => pattern.test(path))) return 120_000;
  if (APP_REFERENCE_PATTERNS.some((pattern) => pattern.test(path))) return 60_000;
  if (SHORT_LIVED_PATTERNS.some((pattern) => pattern.test(path))) return 15_000;
  return 0;
}

function normalizedPath(url: string): string {
  try {
    const parsed = new URL(url, globalThis.location?.origin || 'http://nextou.local');
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function cacheKey(url: string, authorization: string | null): string {
  return `${authorization || 'public'}::${normalizedPath(url)}`;
}

function pruneExpired(now: number): void {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

function trimCache(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}
