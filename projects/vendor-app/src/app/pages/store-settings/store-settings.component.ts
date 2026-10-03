import { VendorStoreSettingsService } from '../../shared/vendor-store-settings/vendor-store-settings.service';
import { Component, inject } from '@angular/core';
import { VendorStoreSettingsComponent } from '../../shared/vendor-store-settings/vendor-store-settings.component';

@Component({
  selector: 'app-store-settings',
  standalone: true,
  imports: [VendorStoreSettingsComponent],
  templateUrl: './store-settings.component.html',
  styleUrl: './store-settings.component.scss',
})
export class StoreSettingsComponent {
  private readonly service = inject(VendorStoreSettingsService);
  hasUnsavedChanges(): boolean {
    return (
      JSON.stringify(this.service.settings()) !==
        JSON.stringify(this.service.savedSettings()) ||
      this.service.accountDirty()
    );
  }
  isSaving(): boolean {
    return (
      this.service.saving() ||
      this.service.accountBusy() ||
      !!this.service.mediaBusy()
    );
  }
}
