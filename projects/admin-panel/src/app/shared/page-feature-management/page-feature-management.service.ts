import { Injectable, computed, signal } from '@angular/core';
import { ApiService } from '@shared/public-api';
import {
  ClonePageForm,
  ManagedAppId,
  ManagedApplication,
  ManagedFeature,
  ManagedPage,
  PageFeatureStats,
  PageSettingsForm,
  PageStatus,
} from './page-feature-management.models';
import { PAGE_FEATURE_APPS } from './page-feature-management.seed';

export interface PageActionModal {
  type: 'features' | 'settings' | 'disable' | 'clone' | null;
  page?: ManagedPage;
}

interface PageFeatureGlobalSettings {
  requireAuthentication: boolean;
  maintenanceMode: boolean;
  enabledByDefault: boolean;
  pageDisabledAlerts: boolean;
  featureAccessRequests: boolean;
  bulkActionAlerts: boolean;
}

interface PersistedPageFeatureState {
  apps: ManagedApplication[];
  globalSettings: PageFeatureGlobalSettings;
}

@Injectable({ providedIn: 'root' })
export class PageFeatureManagementService {
  private readonly storageKey = 'nexconnect_admin_page_feature_management';
  private readonly defaultGlobalSettings: PageFeatureGlobalSettings = {
    requireAuthentication: true,
    maintenanceMode: false,
    enabledByDefault: true,
    pageDisabledAlerts: true,
    featureAccessRequests: true,
    bulkActionAlerts: false,
  };
  private readonly initialState = this.loadPersistedState();

  readonly apps = signal<ManagedApplication[]>(this.initialState.apps);
  readonly activeTab = signal<'applications' | 'pages' | 'settings'>(
    'applications',
  );
  readonly selectedApp = signal<ManagedAppId | 'all'>('all');
  readonly statusFilter = signal<PageStatus | 'all'>('all');
  readonly searchQuery = signal('');
  readonly expandedAppIds = signal<ManagedAppId[]>(['vendor-app']);
  readonly selectedPageIds = signal<string[]>([]);
  readonly modal = signal<PageActionModal>({ type: null });
  readonly toast = signal('');
  readonly loading = signal(true);
  readonly ready = signal(false);

  readonly requireAuthentication = signal(
    this.initialState.globalSettings.requireAuthentication,
  );
  readonly maintenanceMode = signal(
    this.initialState.globalSettings.maintenanceMode,
  );
  readonly enabledByDefault = signal(
    this.initialState.globalSettings.enabledByDefault,
  );
  readonly pageDisabledAlerts = signal(
    this.initialState.globalSettings.pageDisabledAlerts,
  );
  readonly featureAccessRequests = signal(
    this.initialState.globalSettings.featureAccessRequests,
  );
  readonly bulkActionAlerts = signal(
    this.initialState.globalSettings.bulkActionAlerts,
  );

  readonly pages = computed(() => this.apps().flatMap((app) => app.pages));

  constructor(private api: ApiService) {
    this.loadRemoteConfig();
  }

  readonly stats = computed<PageFeatureStats>(() => {
    const pages = this.pages();
    return {
      totalApplications: this.apps().length,
      totalPages: pages.length,
      enabledPages: pages.filter((page) => page.status === 'enabled').length,
      disabledPages: pages.filter((page) => page.status === 'disabled').length,
      partialPages: pages.filter((page) => page.status === 'partial').length,
    };
  });

  readonly appRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const appFilter = this.selectedApp();
    const status = this.statusFilter();

    return this.apps()
      .filter((app) => appFilter === 'all' || app.id === appFilter)
      .map((app) => {
        const pages = app.pages.filter((page) => {
          const matchesStatus = status === 'all' || page.status === status;
          const matchesQuery =
            !query ||
            `${app.name} ${page.name} ${page.route} ${page.description}`
              .toLowerCase()
              .includes(query);
          return matchesStatus && matchesQuery;
        });
        return {
          app,
          pages,
          enabledCount: app.pages.filter((page) => page.status === 'enabled')
            .length,
          disabledCount: app.pages.filter((page) => page.status === 'disabled')
            .length,
          partialCount: app.pages.filter((page) => page.status === 'partial')
            .length,
        };
      });
  });

  loadApplications(): ManagedApplication[] {
    return this.apps();
  }

  loadPages(appId?: ManagedAppId): ManagedPage[] {
    const pages = this.pages();
    return appId ? pages.filter((page) => page.appId === appId) : pages;
  }

  loadPageFeatures(pageId: string): ManagedFeature[] {
    return this.pages().find((page) => page.id === pageId)?.features ?? [];
  }

  updatePageStatus(pageId: string, status: PageStatus): void {
    this.updatePage(pageId, { status, lastUpdated: 'Just now' });
    this.showToast(`Page ${status}`);
  }

  updateFeatureStatus(
    pageId: string,
    featureId: string,
    status: ManagedFeature['status'],
  ): void {
    const page = this.pages().find((item) => item.id === pageId);
    if (!page) {
      this.showToast('Page not found');
      return;
    }

    const features = page.features.map((feature) =>
      feature.id === featureId && !feature.locked
        ? { ...feature, status }
        : feature,
    );
    this.updateFeatureDraft(pageId, features);
  }

  toggleAppExpansion(appId: ManagedAppId): void {
    const expanded = this.expandedAppIds();
    this.expandedAppIds.set(
      expanded.includes(appId)
        ? expanded.filter((id) => id !== appId)
        : [...expanded, appId],
    );
  }

  isExpanded(appId: ManagedAppId): boolean {
    return this.expandedAppIds().includes(appId);
  }

  findApp(appId: ManagedAppId): ManagedApplication | undefined {
    return this.apps().find((app) => app.id === appId);
  }

  appName(appId: ManagedAppId): string {
    return this.findApp(appId)?.name ?? appId;
  }

  togglePageStatus(page: ManagedPage): void {
    const nextStatus: PageStatus =
      page.status === 'disabled' ? 'enabled' : 'disabled';
    this.updatePageStatus(page.id, nextStatus);
  }

  updateFeatureDraft(pageId: string, features: ManagedFeature[]): void {
    this.updatePage(pageId, {
      features,
      status: this.computePageStatus(features),
      lastUpdated: 'Just now',
    });
    this.persistState();
    this.closeModal();
    this.showToast('Features saved');
  }

  savePageSettings(pageId: string, form: PageSettingsForm): void {
    this.updatePage(pageId, {
      name: form.displayName,
      route: form.route,
      description: form.description,
      status: form.status,
      protected: form.protected,
      lastUpdated: 'Just now',
    });
    this.persistState();
    this.closeModal();
    this.showToast('Page settings saved');
  }

  clonePageConfig(page: ManagedPage, form: ClonePageForm): void {
    const clone: ManagedPage = {
      ...page,
      id: `${page.id}-copy-${Date.now()}`,
      name: form.name,
      route: form.route,
      lastUpdated: 'Just now',
      features: form.copyFeatures
        ? page.features.map((feature) => ({
            ...feature,
            id: `${feature.id}-copy`,
          }))
        : [],
    };

    this.apps.update((apps) =>
      apps.map((app) =>
        app.id !== page.appId ? app : { ...app, pages: [...app.pages, clone] },
      ),
    );
    this.persistState();
    this.closeModal();
    this.showToast('Page cloned');
  }

  clonePage(page: ManagedPage, form: ClonePageForm): void {
    this.clonePageConfig(page, form);
  }

  disablePage(page: ManagedPage): void {
    this.updatePageStatus(page.id, 'disabled');
    this.closeModal();
  }

  enableAllPages(appId?: ManagedAppId): void {
    this.bulkStatus('enabled', appId);
  }

  disableAllPages(appId?: ManagedAppId): void {
    this.bulkStatus('disabled', appId);
  }

  bulkEnablePages(): void {
    this.bulkSelected('enabled');
  }

  bulkDisablePages(): void {
    this.bulkSelected('disabled');
  }

  bulkSelected(status: PageStatus): void {
    const ids = this.selectedPageIds();
    if (!ids.length) {
      this.showToast('Select at least one page first');
      return;
    }

    this.apps.update((apps) =>
      apps.map((app) => ({
        ...app,
        pages: app.pages.map((page) =>
          ids.includes(page.id)
            ? { ...page, status, lastUpdated: 'Just now' }
            : page,
        ),
      })),
    );
    this.persistState();
    this.selectedPageIds.set([]);
    this.showToast(`Selected pages ${status}`);
  }

  deleteSelected(): void {
    const ids = this.selectedPageIds();
    if (!ids.length) {
      this.showToast('Select at least one page first');
      return;
    }

    this.apps.update((apps) =>
      apps.map((app) => ({
        ...app,
        pages: app.pages.filter((page) => !ids.includes(page.id)),
      })),
    );
    this.persistState();
    this.selectedPageIds.set([]);
    this.showToast('Selected pages deleted');
  }

  exportSelected(): void {
    const selected = this.pages().filter((page) =>
      this.selectedPageIds().includes(page.id),
    );
    if (!selected.length) {
      this.showToast('Select at least one page first');
      return;
    }

    const blob = new Blob([JSON.stringify(selected, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `page-feature-export-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.showToast('Selected pages exported');
  }

  selectedToggle(pageId: string): void {
    const selected = this.selectedPageIds();
    this.selectedPageIds.set(
      selected.includes(pageId)
        ? selected.filter((id) => id !== pageId)
        : [...selected, pageId],
    );
  }

  resetDefaults(): void {
    this.apps.set(this.clone(PAGE_FEATURE_APPS));
    this.applyGlobalSettings(this.defaultGlobalSettings);
    this.persistState();
    this.showToast('Defaults restored');
  }

  saveGlobalSettings(): void {
    this.persistState();
    this.showToast('Global settings saved');
  }

  openModal(
    type: Exclude<PageActionModal['type'], null>,
    page: ManagedPage,
  ): void {
    this.modal.set({ type, page });
  }

  closeModal(): void {
    this.modal.set({ type: null });
  }

  private bulkStatus(status: PageStatus, appId?: ManagedAppId): void {
    this.apps.update((apps) =>
      apps.map((app) => ({
        ...app,
        pages: app.pages.map((page) =>
          !appId || page.appId === appId
            ? { ...page, status, lastUpdated: 'Just now' }
            : page,
        ),
      })),
    );
    this.persistState();
    this.showToast(`Pages ${status}`);
  }

  private updatePage(pageId: string, patch: Partial<ManagedPage>): void {
    this.apps.update((apps) =>
      apps.map((app) => ({
        ...app,
        pages: app.pages.map((page) =>
          page.id === pageId ? { ...page, ...patch } : page,
        ),
      })),
    );
    this.persistState();
  }

  private computePageStatus(features: ManagedFeature[]): PageStatus {
    if (!features.length) return 'enabled';
    const enabled = features.filter(
      (feature) => feature.status === 'enabled',
    ).length;
    if (enabled === 0) return 'disabled';
    if (enabled === features.length) return 'enabled';
    return 'partial';
  }

  private showToast(message: string): void {
    this.toast.set(message);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => this.toast.set(''), 2200);
    }
  }

  private loadPersistedState(): PersistedPageFeatureState {
    if (typeof localStorage === 'undefined') {
      return {
        apps: this.clone(PAGE_FEATURE_APPS),
        globalSettings: { ...this.defaultGlobalSettings },
      };
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return {
          apps: this.clone(PAGE_FEATURE_APPS),
          globalSettings: { ...this.defaultGlobalSettings },
        };
      }

      const parsed = JSON.parse(raw) as Partial<PersistedPageFeatureState>;
      return {
        apps: Array.isArray(parsed.apps)
          ? parsed.apps
          : this.clone(PAGE_FEATURE_APPS),
        globalSettings: {
          ...this.defaultGlobalSettings,
          ...(parsed.globalSettings ?? {}),
        },
      };
    } catch {
      return {
        apps: this.clone(PAGE_FEATURE_APPS),
        globalSettings: { ...this.defaultGlobalSettings },
      };
    }
  }

  private persistState(): void {
    const payload: PersistedPageFeatureState = {
      apps: this.apps(),
      globalSettings: this.currentGlobalSettings(),
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    }
    this.api
      .updateAdminPageFeatureConfig({
        applications: payload.apps,
        global_settings: payload.globalSettings,
      })
      .subscribe({
        next: (response) => this.applyRemoteConfig(response),
        error: () => this.showToast('Saved locally. Backend sync failed.'),
      });
  }

  private currentGlobalSettings(): PageFeatureGlobalSettings {
    return {
      requireAuthentication: this.requireAuthentication(),
      maintenanceMode: this.maintenanceMode(),
      enabledByDefault: this.enabledByDefault(),
      pageDisabledAlerts: this.pageDisabledAlerts(),
      featureAccessRequests: this.featureAccessRequests(),
      bulkActionAlerts: this.bulkActionAlerts(),
    };
  }

  private applyGlobalSettings(settings: PageFeatureGlobalSettings): void {
    this.requireAuthentication.set(settings.requireAuthentication);
    this.maintenanceMode.set(settings.maintenanceMode);
    this.enabledByDefault.set(settings.enabledByDefault);
    this.pageDisabledAlerts.set(settings.pageDisabledAlerts);
    this.featureAccessRequests.set(settings.featureAccessRequests);
    this.bulkActionAlerts.set(settings.bulkActionAlerts);
  }

  private clone<T>(value: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value)) as T;
  }

  private loadRemoteConfig(): void {
    this.loading.set(true);
    this.api.getAdminPageFeatureConfig().subscribe({
      next: (response) => {
        const applications =
          Array.isArray(response?.applications) && response.applications.length
            ? response.applications
            : this.clone(PAGE_FEATURE_APPS);
        this.apps.set(applications);
        this.applyGlobalSettings(this.remoteGlobalSettings(response));
        if (
          !Array.isArray(response?.applications) ||
          response.applications.length === 0
        ) {
          this.persistState();
        }
        this.ready.set(true);
        this.loading.set(false);
      },
      error: () => {
        const localState = this.loadPersistedState();
        this.apps.set(localState.apps);
        this.applyGlobalSettings(localState.globalSettings);
        this.ready.set(true);
        this.loading.set(false);
      },
    });
  }

  private applyRemoteConfig(response: any): void {
    if (Array.isArray(response?.applications) && response.applications.length) {
      this.apps.set(response.applications);
    }
    this.applyGlobalSettings(this.remoteGlobalSettings(response));
  }

  private remoteGlobalSettings(response: any): PageFeatureGlobalSettings {
    return {
      ...this.defaultGlobalSettings,
      ...(response?.global_settings ?? response?.globalSettings ?? {}),
    };
  }
}
