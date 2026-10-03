import { inject } from '@angular/core';
import { AdminAccessService } from '../../services/admin-access.service';
import { Component, computed, signal } from '@angular/core';
import { AdminDialogDirective } from '../admin-dialog.directive';
import { AdminRowActionsComponent } from '../admin-row-actions.component';
import { FormsModule } from '@angular/forms';
import { ClonePageForm, ManagedAppId, ManagedFeature, ManagedPage, PageSettingsForm } from './page-feature-management.models';
import { PageFeatureManagementService } from './page-feature-management.service';

@Component({
  selector: 'nc-page-feature-management',
  standalone: true,
  imports: [FormsModule, AdminDialogDirective, AdminRowActionsComponent],
  templateUrl: './page-feature-management.component.html',
  styleUrls: ['./page-feature-management.component.scss'],
})
export class PageFeatureManagementComponent {
  readonly access=inject(AdminAccessService);
  readonly actionMenuFor = signal<string | null>(null);
  readonly featureDraft = signal<ManagedFeature[]>([]);
  readonly settingsForm = signal<PageSettingsForm | null>(null);
  readonly cloneForm = signal<ClonePageForm | null>(null);
  readonly modalPage = computed(() => this.service.modal().page);
  readonly matchingPageCount = computed(() => this.service.appRows().reduce((count, row) => count + row.pages.length, 0));

  constructor(public service: PageFeatureManagementService) {}

  selectTab(tab: 'applications' | 'pages' | 'settings'): void {
    this.service.activeTab.set(tab);
    this.actionMenuFor.set(null);
  }

  viewApplication(appId: ManagedAppId): void {
    this.selectTab('pages');
    this.service.selectedApp.set(appId);
    this.service.expandedAppIds.set([appId]);
  }

  appTone(appId: ManagedAppId): string {
    return this.service.findApp(appId)?.color ?? 'purple';
  }

  openActions(page: ManagedPage): void {
    this.actionMenuFor.set(this.actionMenuFor() === page.id ? null : page.id);
  }

  viewPage(page: ManagedPage): void {
    this.openSettingsModal(page);
  }

  openFeatureModal(page: ManagedPage): void {
    this.featureDraft.set(page.features.map((feature) => ({ ...feature })));
    this.service.openModal('features', page);
    this.actionMenuFor.set(null);
  }

  openSettingsModal(page: ManagedPage): void {
    this.settingsForm.set({
      displayName: page.name,
      route: page.route,
      icon: 'dashboard',
      description: page.description,
      status: page.status,
      protected: Boolean(page.protected),
    });
    this.service.openModal('settings', page);
    this.actionMenuFor.set(null);
  }

  openCloneModal(page: ManagedPage): void {
    this.cloneForm.set({
      name: `${page.name} (Copy)`,
      route: `${page.route.replace(/\/$/, '')}-copy`,
      copyFeatures: true,
    });
    this.service.openModal('clone', page);
    this.actionMenuFor.set(null);
  }

  openDisableModal(page: ManagedPage): void {
    this.service.openModal('disable', page);
    this.actionMenuFor.set(null);
  }

  updateFeatureDraft(featureId: string, enabled: boolean): void {
    this.featureDraft.update((features) =>
      features.map((feature) =>
        feature.id === featureId
          ? { ...feature, status: enabled ? 'enabled' : 'disabled' }
          : feature
      )
    );
  }

  saveFeatureDraft(): void {
    const page = this.modalPage();
    if (!page) return;
    this.service.updateFeatureDraft(page.id, this.featureDraft());
  }

  updateSettingsForm(patch: Partial<PageSettingsForm>): void {
    const current = this.settingsForm();
    if (current) this.settingsForm.set({ ...current, ...patch });
  }

  saveSettingsForm(): void {
    const page = this.modalPage();
    const form = this.settingsForm();
    if (!page || !form) return;
    this.service.savePageSettings(page.id, form);
  }

  updateCloneForm(patch: Partial<ClonePageForm>): void {
    const current = this.cloneForm();
    if (current) this.cloneForm.set({ ...current, ...patch });
  }

  clonePage(): void {
    const page = this.modalPage();
    const form = this.cloneForm();
    if (!page || !form) return;
    this.service.clonePage(page, form);
  }

  disablePage(): void {
    const page = this.modalPage();
    if (page) this.service.disablePage(page);
  }

  toggleGlobalSetting(
    key:
      | 'requireAuthentication'
      | 'maintenanceMode'
      | 'enabledByDefault'
      | 'pageDisabledAlerts'
      | 'featureAccessRequests'
      | 'bulkActionAlerts'
  ): void {
    this.service[key].set(!this.service[key]());
  }
}
