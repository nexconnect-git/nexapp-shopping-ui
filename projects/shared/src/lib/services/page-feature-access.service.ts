import { Injectable, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  tap,
  timeout,
} from 'rxjs';
import { FeatureConfigApi } from '../api/feature-config-api.service';

export type ManagedAppId =
  | 'vendor-app'
  | 'delivery-app'
  | 'customer-app'
  | 'mobile-customer';
export type PageStatus = 'enabled' | 'disabled' | 'partial';
export type PageFeatureFailMode = 'open' | 'closed';
export type PageFeatureLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface PageFeatureInitializeOptions {
  pollIntervalMs?: number;
  failMode?: PageFeatureFailMode;
  enableFocusRefresh?: boolean;
}

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
  private readonly appOptions = new Map<ManagedAppId, PageFeatureInitializeOptions>();
  private readonly config = signal<PageFeatureConfig>({ applications: [] });
  private readonly resolved = signal(false);
  private readonly loading = signal(false);
  private readonly state = signal<PageFeatureLoadState>('idle');
  private readonly loadFailed = signal(false);
  private readonly minRefreshIntervalMs = 30_000;
  private lastLoadedAt = 0;
  private focusHandler?: () => void;
  private visibilityHandler?: () => void;
  private loading$?: Observable<PageFeatureConfig>;

  readonly applications = this.config.asReadonly();
  readonly hasResolved = this.resolved.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly loadState = this.state.asReadonly();

  constructor(private api: FeatureConfigApi) {}

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
    this.state.set('loading');
    this.loading$ = this.api.getPageFeatureConfig().pipe(
      timeout({ first: 6000 }),
      map((response) => this.normalizeConfig(response)),
      tap((config) => {
        this.config.set(config);
        this.resolved.set(true);
        this.loadFailed.set(false);
        this.state.set('ready');
        this.lastLoadedAt = Date.now();
      }),
      catchError(() => {
        this.resolved.set(true);
        this.loadFailed.set(true);
        this.state.set('error');
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

  initialize(
    appId: ManagedAppId,
    options: PageFeatureInitializeOptions = {},
  ): void {
    if (typeof window === 'undefined') return;

    const normalizedOptions: PageFeatureInitializeOptions = {
      failMode: options.failMode || 'open',
      enableFocusRefresh: options.enableFocusRefresh !== false,
      pollIntervalMs: options.pollIntervalMs,
    };
    this.appOptions.set(appId, normalizedOptions);

    this.loadConfig(!this.resolved()).subscribe();

    const existingPoller = this.pollers.get(appId);
    if (existingPoller && existingPoller > 0) {
      window.clearInterval(existingPoller);
    }

    const intervalMs = normalizedOptions.pollIntervalMs;
    if (intervalMs && intervalMs > 0) {
      const id = window.setInterval(() => {
        this.refresh().subscribe();
      }, intervalMs);
      this.pollers.set(appId, id);
    } else {
      this.pollers.set(appId, -1);
    }

    if (normalizedOptions.enableFocusRefresh) {
      this.bindFocusRefresh();
    }
  }

  startPolling(appId: ManagedAppId): void {
    if (this.pollers.has(appId)) return;
    this.initialize(appId, {
      pollIntervalMs: this.minRefreshIntervalMs,
      failMode: 'open',
      enableFocusRefresh: true,
    });
  }

  stopPolling(appId: ManagedAppId): void {
    const id = this.pollers.get(appId);
    if (id && id > 0 && typeof window !== 'undefined') window.clearInterval(id);
    this.pollers.delete(appId);
    this.appOptions.delete(appId);
    if (!this.pollers.size) this.unbindFocusRefresh();
  }

  stop(appId: ManagedAppId): void {
    this.stopPolling(appId);
  }

  refresh(): Observable<PageFeatureConfig> {
    return this.loadConfig(true);
  }

  isPageEnabled(
    appId: ManagedAppId,
    pageId: string,
    failMode: PageFeatureFailMode = this.failModeFor(appId),
  ): boolean {
    if (!this.resolved() || this.loadFailed()) return failMode === 'open';
    const app = this.config().applications.find((item) => item.id === appId);
    if (!app) return true;
    const page = app.pages.find((item) => item.id === pageId);
    return page ? page.status !== 'disabled' : true;
  }

  isRouteEnabled(
    appId: ManagedAppId,
    route: string,
    failMode: PageFeatureFailMode = this.failModeFor(appId),
  ): boolean {
    if (!this.resolved() || this.loadFailed()) return failMode === 'open';
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
    failMode: PageFeatureFailMode = this.failModeFor(appId),
  ): boolean {
    if (!this.resolved() || this.loadFailed()) return failMode === 'open';
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
    if (this.focusHandler || typeof window === 'undefined') return;
    this.focusHandler = () => this.refresh().subscribe();
    window.addEventListener('focus', this.focusHandler);
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (!document.hidden) this.refresh().subscribe();
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private unbindFocusRefresh(): void {
    if (typeof window !== 'undefined' && this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
    }
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.focusHandler = undefined;
    this.visibilityHandler = undefined;
  }

  private failModeFor(appId: ManagedAppId): PageFeatureFailMode {
    return this.appOptions.get(appId)?.failMode || 'open';
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
