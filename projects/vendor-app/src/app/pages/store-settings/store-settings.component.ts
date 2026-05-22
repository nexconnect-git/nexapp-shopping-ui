import { Component } from '@angular/core';
import { VendorStoreSettingsComponent } from '../../shared/vendor-store-settings/vendor-store-settings.component';

@Component({
  selector: 'app-store-settings',
  standalone: true,
  imports: [VendorStoreSettingsComponent],
  templateUrl: './store-settings.component.html',
  styleUrl: './store-settings.component.scss',
})
export class StoreSettingsComponent {}
