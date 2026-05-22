import { Injectable, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  tap,
} from 'rxjs';
import { ApiService } from './api.service';

export type ManagedAppId =
  | 'vendor-app'
  | 'delivery-app'
  | 'customer-app'
  | 'mobile-customer';
export type PageStatus = 'enabled' | 'disabled' | 'partial';

export interface ManagedFeatureConfig {
  id: string;
  name: string;
  description?: string;
  status: 'enabled' | 'disabled';
}

export interface ManagedPageConfig {
  id: string;
  appId: ManagedAppId;
  name: string;
  route: string;
  status: PageStatus;
  features?: ManagedFeatureConfig[];
}

export interface ManagedApplicationConfig {
  id: ManagedAppId;
  name: string;
  pages: ManagedPageConfig[];
}

export interface PageFeatureConfig {
  applications: ManagedApplicationConfig[];
  global_settings?: Record<string, unknown>;
  is_enabled?: boolean;
  version?: number;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class PageFeatureAccessService {
  private readonly pollers = new Map<ManagedAppId, number>();
  private readonly config = signal<PageFeatureConfig>({ applications: [] });
  private readonly resolved = signal(false);
  private readonly loading = signal(false);
  private readonly minRefreshIntervalMs = 30_000;
  private lastLoadedAt = 0;
  private focusRefreshBound = false;
  private loading$?: Observable<PageFeatureConfig>;

  readonly applications = this.config.asReadonly();
  readonly hasResolved = this.resolved.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  constructor(private api: ApiService) {}

  loadConfig(force = false): Observable<PageFeatureConfig> {
    if (this.loading$) return this.loading$;
    if (!force && this.resolved()) return of(this.config());
    if (
      force &&
      this.resolved() &&
      Date.now() - this.lastLoadedAt < this.minRefreshIntervalMs
    ) {
      return of(this.config());
    }

    this.loading.set(true);
    this.loading$ = this.api.getPageFeatureConfig().pipe(
      map((response) => this.normalizeConfig(response)),
      tap((config) => {
        this.config.set(config);
        this.resolved.set(true);
        this.lastLoadedAt = Date.now();
      }),
      catchError(() => {
        this.resolved.set(true);
        this.lastLoadedAt = Date.now();
        return of(this.config());
      }),
      finalize(() => {
        this.loading.set(false);
        this.loading$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.loading$;
  }

  startPolling(appId: ManagedAppId): void {
    if (this.pollers.has(appId) || typeof window === 'undefined') return;
    this.pollers.set(appId, -1);
    this.loadConfig(!this.resolved()).subscribe();
    this.bindFocusRefresh();
  }

  stopPolling(appId: ManagedAppId): void {
    const id = this.pollers.get(appId);
    if (id && id > 0 && typeof window !== 'undefined') window.clearInterval(id);
    this.pollers.delete(appId);
  }

  refresh(): Observable<PageFeatureConfig> {
    return this.loadConfig(true);
  }

  isPageEnabled(appId: ManagedAppId, pageId: string): boolean {
    if (!this.resolved()) return false;
    const app = this.config().applications.find((item) => item.id === appId);
    if (!app) return true;
    const page = app.pages.find((item) => item.id === pageId);
    return page ? page.status !== 'disabled' : true;
  }

  isRouteEnabled(appId: ManagedAppId, route: string): boolean {
    if (!this.resolved()) return false;
    const app = this.config().applications.find((item) => item.id === appId);
    if (!app) return true;

    const normalizedRoute = this.normalizeRoute(route);
    const page = [...app.pages]
      .sort((a, b) => b.route.length - a.route.length)
      .find((item) =>
        this.routeMatches(this.normalizeRoute(item.route), normalizedRoute),
      );
    return page ? page.status !== 'disabled' : true;
  }

  featureEnabled(
    appId: ManagedAppId,
    pageId: string,
    featureId: string,
  ): boolean {
    if (!this.resolved()) return false;
    const app = this.config().applications.find((item) => item.id === appId);
    const page = app?.pages.find((item) => item.id === pageId);
    const feature = page?.features?.find(
      (item) => item.id === featureId || item.id.endsWith(`-${featureId}`),
    );
    return feature ? feature.status !== 'disabled' : true;
  }

  private normalizeConfig(response: any): PageFeatureConfig {
    return {
      applications: Array.isArray(response?.applications)
        ? response.applications
        : [],
      global_settings:
        response?.global_settings || response?.globalSettings || {},
      is_enabled: response?.is_enabled !== false,
      version: Number(response?.version || 1),
      updated_at: response?.updated_at,
    };
  }

  private bindFocusRefresh(): void {
    if (this.focusRefreshBound || typeof window === 'undefined') return;
    this.focusRefreshBound = true;
    window.addEventListener('focus', () => this.refresh().subscribe());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.refresh().subscribe();
      });
    }
  }

  private normalizeRoute(route: string): string {
    const value = String(route || '/')
      .split('?')[0]
      .split('#')[0]
      .trim();
    if (!value || value === '/') return '/';
    return `/${value.replace(/^\/+|\/+$/g, '')}`;
  }

  private routeMatches(pattern: string, route: string): boolean {
    if (pattern === route) return true;
    const patternParts = pattern.split('/').filter(Boolean);
    const routeParts = route.split('/').filter(Boolean);
    if (patternParts.length !== routeParts.length) return false;
    return patternParts.every(
      (part, index) => part.startsWith(':') || part === routeParts[index],
    );
  }
}
