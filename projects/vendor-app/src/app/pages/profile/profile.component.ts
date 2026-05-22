import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  AppCurrencyPipe,
  AuthService,
  MapLocation,
  MapPickerComponent,
  ToastService,
} from '@shared/public-api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, MapPickerComponent, AppCurrencyPipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toastService = inject(ToastService);

  profile: any = {};
  vendor: any = {};
  loading = signal(true);
  saving = signal(false);
  logoUploading = signal(false);
  showLocationMap = signal(false);

  ngOnInit() {
    let loaded = 0;
    const done = () => {
      if (++loaded === 2) this.loading.set(false);
    };
    this.api.getProfile().subscribe({
      next: (u) => {
        this.profile = { ...u };
        done();
      },
      error: done,
    });
    this.api.getVendorProfile().subscribe({
      next: (v) => {
        this.vendor = { ...v };
        done();
      },
      error: done,
    });
  }

  onLogoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.vendor = { ...this.vendor, logo: e.target?.result as string };
    };
    reader.readAsDataURL(file);
    this.logoUploading.set(true);
    this.api.uploadVendorLogoSelf(file).subscribe({
      next: (v) => {
        if (v.logo) this.vendor = { ...this.vendor, logo: v.logo };
        this.logoUploading.set(false);
      },
      error: () => this.logoUploading.set(false),
    });
  }

  onLocationPicked(loc: MapLocation) {
    this.vendor.latitude = loc.lat;
    this.vendor.longitude = loc.lng;
    this.vendor.address = loc.address || this.vendor.address;
    if (loc.city) this.vendor.city = loc.city;
    if (loc.state) this.vendor.state = loc.state;
    if (loc.postal_code) this.vendor.postal_code = loc.postal_code;
  }

  save() {
    this.saving.set(true);
    let completed = 0;
    const finish = () => {
      if (++completed === 2) {
        this.saving.set(false);
        this.toastService.show('Profile saved successfully!', 'success');
      }
    };
    const fail = (err: any) => {
      const e = err.error;
      this.toastService.show(
        typeof e === 'object'
          ? Object.values(e).flat().join(' ')
          : 'Save failed.',
        'error',
      );
      this.saving.set(false);
    };
    this.api.updateProfile(this.profile).subscribe({
      next: (u) => {
        this.auth.updateUserData(u);
        finish();
      },
      error: fail,
    });
    this.api
      .updateVendorProfile(this.vendor)
      .subscribe({ next: () => finish(), error: fail });
  }
}
