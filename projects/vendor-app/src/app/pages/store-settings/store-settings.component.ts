import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, MapLocation, MapPickerComponent, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-store-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MapPickerComponent],
  templateUrl: './store-settings.component.html',
  styleUrl: './store-settings.component.scss'
})
export class StoreSettingsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  settings: any = {};
  loading = signal(true);
  saving = signal(false);
  showLocationMap = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getVendorStoreSettings().subscribe({
      next: (settings) => {
        this.settings = { ...settings };
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load store settings.', 'error');
      }
    });
  }

  save() {
    this.saving.set(true);
    this.api.updateVendorStoreSettings(this.buildSavePayload()).subscribe({
      next: (settings) => {
        this.settings = { ...settings };
        this.saving.set(false);
        this.toast.show('Store settings saved.', 'success');
      },
      error: (err) => {
        this.saving.set(false);
        const message = this.formatSaveError(err?.error);
        this.toast.show(message || 'Failed to save store settings.', 'error');
      }
    });
  }

  onLocationPicked(location: MapLocation) {
    this.settings.latitude = location.lat;
    this.settings.longitude = location.lng;
    this.settings.address = location.address || this.settings.address;
    if (location.city) this.settings.city = location.city;
    if (location.state) this.settings.state = location.state;
    if (location.postal_code) this.settings.postal_code = location.postal_code;
  }

  private buildSavePayload() {
    const {
      id,
      user_info,
      logo,
      banner,
      status,
      average_rating,
      total_ratings,
      is_featured,
      wallet_balance,
      created_at,
      updated_at,
      is_open_now,
      availability_note,
      ...payload
    } = this.settings || {};
    return payload;
  }

  private formatSaveError(error: any): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    return Object.entries(error)
      .map(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
        return `${field}: ${text}`;
      })
      .join(' ');
  }
}
