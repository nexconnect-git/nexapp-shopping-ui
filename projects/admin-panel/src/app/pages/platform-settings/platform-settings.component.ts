import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-platform-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './platform-settings.component.html',
  styleUrl: './platform-settings.component.scss'
})
export class PlatformSettingsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  form: any = {
    upi_id: '',
    enabled_payment_methods: [],
    delivery_base_fee: 0,
    delivery_per_km_fee: 0,
    free_delivery_above: 0,
    cancellation_window_minutes: 0,
    cancellation_allowed_statuses: ''
  };
  paymentMethods = [
    { key: 'razorpay_upi', label: 'UPI', description: 'Google Pay, PhonePe, Paytm UPI' },
    { key: 'razorpay_card', label: 'Cards', description: 'Credit and debit cards' },
    { key: 'razorpay_wallet', label: 'Wallets', description: 'Amazon Pay, Paytm, Mobikwik' },
    { key: 'razorpay_netbanking', label: 'Netbanking', description: 'All major banks' },
    { key: 'cod', label: 'Cash on delivery', description: 'Allow customers to pay at handoff' }
  ];

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getPlatformSettings().subscribe({
      next: (settings) => {
        this.form = { ...settings };
        this.form.enabled_payment_methods = Array.isArray(this.form.enabled_payment_methods) ? this.form.enabled_payment_methods : [];
        if (Array.isArray(this.form.cancellation_allowed_statuses)) {
          this.form.cancellation_allowed_statuses = this.form.cancellation_allowed_statuses.join(',');
        }
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load platform settings.', 'error');
        this.loading.set(false);
      }
    });
  }

  save() {
    const payload = {
      ...this.form,
      enabled_payment_methods: Array.isArray(this.form.enabled_payment_methods) ? this.form.enabled_payment_methods : [],
      cancellation_allowed_statuses: String(this.form.cancellation_allowed_statuses || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
    };

    this.saving.set(true);
    this.api.updatePlatformSettings(payload).subscribe({
      next: (settings) => {
        this.form = { ...settings };
        this.form.enabled_payment_methods = Array.isArray(this.form.enabled_payment_methods) ? this.form.enabled_payment_methods : [];
        if (Array.isArray(this.form.cancellation_allowed_statuses)) {
          this.form.cancellation_allowed_statuses = this.form.cancellation_allowed_statuses.join(',');
        }
        this.toast.show('Platform settings updated.', 'success');
        this.saving.set(false);
      },
      error: () => {
        this.toast.show('Failed to update platform settings.', 'error');
        this.saving.set(false);
      }
    });
  }

  isPaymentMethodEnabled(key: string) {
    return Array.isArray(this.form.enabled_payment_methods) && this.form.enabled_payment_methods.includes(key);
  }

  togglePaymentMethod(key: string) {
    const current = Array.isArray(this.form.enabled_payment_methods) ? [...this.form.enabled_payment_methods] : [];
    this.form.enabled_payment_methods = current.includes(key)
      ? current.filter((item: string) => item !== key)
      : [...current, key];
  }
}
