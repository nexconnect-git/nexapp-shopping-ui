import {
  HttpContextToken,
  type HttpEvent,
  type HttpInterceptorFn,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, tap, shareReplay, finalize } from 'rxjs';
import { CookieService } from '../services/cookie.service';

export const SKIP_HTTP_CACHE = new HttpContextToken<boolean>(() => false);

type CacheEntry = {
  expiresAt: number;
  response?: HttpResponse<unknown>;
  request$?: Observable<HttpEvent<unknown>>;
};

type SerializedCacheEntry = {
  body: unknown;
  expiresAt: number;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  url: string | null;
};

const cache = new Map<string, CacheEntry>();
const CACHE_STORAGE_PREFIX = 'nextou_http_cache_v1::';
const CACHE_STAMP_COOKIE = 'nextou_http_cache_stamp';
const MAX_CACHE_ENTRIES = 160;
const MAX_PERSISTED_RESPONSE_BYTES = 250_000;
let lastCacheStamp = '';

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
  clearPersistedCache();
}

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  const cookies = inject(CookieService);
  syncCacheStamp(cookies);

  if (req.method !== 'GET') {
    clearHttpCache();
    bumpCacheStamp(cookies);
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

  const persisted = readPersistedCache(key, now);
  if (persisted) {
    cache.set(key, {
      expiresAt: persisted.expiresAt,
      response: persisted.response.clone(),
    });
    return of(persisted.response.clone());
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
        writePersistedCache(key, event, ttlMs);
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
  const scope = authorization ? `auth-${hashValue(authorization)}` : 'public';
  return `${scope}::${normalizedPath(url)}`;
}

function hashValue(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
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
    removePersistedCache(oldestKey);
  }
}

function syncCacheStamp(cookies: CookieService): void {
  const stamp = cookies.get(CACHE_STAMP_COOKIE) || '';
  if (!lastCacheStamp) {
    lastCacheStamp = stamp;
    return;
  }
  if (stamp === lastCacheStamp) return;
  clearHttpCache();
  lastCacheStamp = stamp;
}

function bumpCacheStamp(cookies: CookieService): void {
  lastCacheStamp = String(Date.now());
  cookies.set(CACHE_STAMP_COOKIE, lastCacheStamp, {
    maxAgeSeconds: 60 * 60 * 24 * 7,
  });
}

function storageAvailable(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function storageKey(key: string): string {
  return `${CACHE_STORAGE_PREFIX}${key}`;
}

function readPersistedCache(
  key: string,
  now: number,
): { expiresAt: number; response: HttpResponse<unknown> } | null {
  if (!storageAvailable()) return null;
  const storedKey = storageKey(key);
  const raw = sessionStorage.getItem(storedKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SerializedCacheEntry;
    if (!parsed.expiresAt || parsed.expiresAt <= now) {
      sessionStorage.removeItem(storedKey);
      return null;
    }
    const response = new HttpResponse({
      body: parsed.body,
      headers: new HttpHeaders(parsed.headers || {}),
      status: parsed.status,
      statusText: parsed.statusText,
      url: parsed.url || undefined,
    });
    return { expiresAt: parsed.expiresAt, response };
  } catch {
    sessionStorage.removeItem(storedKey);
    return null;
  }
}

function writePersistedCache(
  key: string,
  response: HttpResponse<unknown>,
  ttlMs: number,
): void {
  if (!storageAvailable()) return;
  const headers = response.headers.keys().reduce<Record<string, string>>(
    (result, header) => {
      result[header] = response.headers.get(header) || '';
      return result;
    },
    {},
  );
  const payload: SerializedCacheEntry = {
    body: response.body,
    expiresAt: Date.now() + ttlMs,
    headers,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
  };
  const raw = JSON.stringify(payload);
  if (raw.length > MAX_PERSISTED_RESPONSE_BYTES) return;
  try {
    sessionStorage.setItem(storageKey(key), raw);
  } catch {
    clearPersistedCache();
  }
}

function removePersistedCache(key: string): void {
  if (!storageAvailable()) return;
  sessionStorage.removeItem(storageKey(key));
}

function clearPersistedCache(): void {
  if (!storageAvailable()) return;
  const keys: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(CACHE_STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => sessionStorage.removeItem(key));
}
