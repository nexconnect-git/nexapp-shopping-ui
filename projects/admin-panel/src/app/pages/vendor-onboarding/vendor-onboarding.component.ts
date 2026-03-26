import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';

interface StepConfig {
  id: number;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-vendor-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vendor-onboarding.component.html',
  styleUrl:    './vendor-onboarding.component.scss',
})
export class VendorOnboardingComponent {
  private api    = inject(ApiService);
  private router = inject(Router);

  currentStep = signal(1);
  saving      = signal(false);
  error       = signal('');
  fieldErrors = signal<Record<string, string>>({});

  readonly steps: StepConfig[] = [
    { id: 1, label: 'Account',    icon: 'manage_accounts' },
    { id: 2, label: 'Basic Info', icon: 'storefront'      },
    { id: 3, label: 'Legal',      icon: 'gavel'           },
    { id: 4, label: 'Bank',       icon: 'account_balance' },
    { id: 5, label: 'Logistics',  icon: 'local_shipping'  },
    { id: 6, label: 'Operations', icon: 'settings'        },
  ];

  // ── Step 1: Account credentials ──────────────────────────────────────────
  s1 = {
    username: '', password: '', confirm_password: '',
    first_name: '', last_name: '',
  };

  // ── Step 2: Basic store info ──────────────────────────────────────────────
  s2 = {
    store_name: '', vendor_type: 'individual', description: '',
    phone: '', email: '',
    address: '', city: '', state: '', postal_code: '',
    latitude: 0, longitude: 0,
    gst_registered: false,
  };

  // ── Step 3: Legal & compliance ────────────────────────────────────────────
  s3 = {
    legal_name: '',
    contact_person_name: '', contact_person_email: '', contact_person_phone: '',
    pan_number: '', gstin: '', cin_udyam: '',
    fssai_license: '', trademark_number: '',
    business_addresses: [] as { line1: string; city: string; state: string; pincode: string }[],
  };

  // ── Step 4: Bank & payment ────────────────────────────────────────────────
  s4 = {
    account_holder_name: '',
    account_number: '',  confirm_account_number: '',
    ifsc_code: '', bank_name: '', branch_name: '',
    account_type: 'current', upi_id: '',
    settlement_cycle: 'T+7',
    commission_percentage: 0,
  };

  // ── Step 5: Logistics & fulfillment ──────────────────────────────────────
  s5 = {
    fulfillment_type: 'vendor',
    dispatch_sla_hours: 24,
    return_policy: '',
    packaging_preferences: '',
    serviceable_pincodes: [] as { pincode: string; city: string; state: string }[],
    new_pincode: '', new_pincode_city: '', new_pincode_state: '',
  };

  // ── Step 6: Operational settings ─────────────────────────────────────────
  s6 = {
    opening_time: '09:00', closing_time: '22:00',
    min_order_amount: 0, delivery_radius_km: 5,
    auto_order_acceptance: false,
    cancellation_rules: '',
    vendor_tier: 'basic',
    is_open: true, is_featured: false,
    holidays: [] as { date: string; reason: string }[],
    new_holiday_date: '', new_holiday_reason: '',
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  goStep(n: number) {
    if (n < 1 || n > this.steps.length) return;
    this.error.set('');
    this.fieldErrors.set({});
    this.currentStep.set(n);
  }

  next() {
    const err = this.validateStep(this.currentStep());
    if (err) { this.error.set(err); return; }
    this.error.set('');
    this.fieldErrors.set({});
    if (this.currentStep() < this.steps.length) this.currentStep.update(s => s + 1);
  }

  back() {
    this.error.set('');
    if (this.currentStep() > 1) this.currentStep.update(s => s - 1);
  }

  validateStep(step: number): string {
    switch (step) {
      case 1:
        if (!this.s1.username.trim()) return 'Username is required.';
        if (this.s1.username.length < 3) return 'Username must be at least 3 characters.';
        if (this.s1.password) {
          if (this.s1.password.length < 8) return 'Password must be at least 8 characters.';
          if (this.s1.password !== this.s1.confirm_password) return 'Passwords do not match.';
        }
        break;
      case 2:
        if (!this.s2.store_name.trim()) return 'Store name is required.';
        if (!this.s2.phone.trim()) return 'Phone number is required.';
        if (!this.s2.email.trim()) return 'Email is required.';
        if (!/\S+@\S+\.\S+/.test(this.s2.email)) return 'Enter a valid email address.';
        break;
      case 4:
        if (this.s4.account_number && this.s4.account_number !== this.s4.confirm_account_number)
          return 'Account numbers do not match.';
        if (this.s4.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(this.s4.ifsc_code))
          return 'Invalid IFSC code format (e.g. SBIN0001234).';
        if (this.s4.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(this.s3.pan_number))
          break; // PAN is in step 3
        break;
    }
    return '';
  }

  // ── Serviceable areas ─────────────────────────────────────────────────────
  addPincode() {
    const p = this.s5.new_pincode.trim();
    if (!p) return;
    if (this.s5.serviceable_pincodes.some(a => a.pincode === p)) return;
    this.s5.serviceable_pincodes.push({
      pincode: p,
      city:  this.s5.new_pincode_city.trim(),
      state: this.s5.new_pincode_state.trim(),
    });
    this.s5.new_pincode = '';
    this.s5.new_pincode_city = '';
    this.s5.new_pincode_state = '';
  }

  removePincode(i: number) {
    this.s5.serviceable_pincodes.splice(i, 1);
  }

  // ── Holidays ──────────────────────────────────────────────────────────────
  addHoliday() {
    const d = this.s6.new_holiday_date;
    if (!d) return;
    if (this.s6.holidays.some(h => h.date === d)) return;
    this.s6.holidays.push({ date: d, reason: this.s6.new_holiday_reason.trim() });
    this.s6.new_holiday_date = '';
    this.s6.new_holiday_reason = '';
  }

  removeHoliday(i: number) {
    this.s6.holidays.splice(i, 1);
  }

  // ── Business addresses ────────────────────────────────────────────────────
  addBusinessAddress() {
    this.s3.business_addresses.push({ line1: '', city: '', state: '', pincode: '' });
  }

  removeBusinessAddress(i: number) {
    this.s3.business_addresses.splice(i, 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  submit() {
    for (let i = 1; i <= this.steps.length; i++) {
      const err = this.validateStep(i);
      if (err) { this.currentStep.set(i); this.error.set(err); return; }
    }

    this.saving.set(true);
    this.error.set('');
    this.fieldErrors.set({});

    const payload: any = {
      // Step 1
      username:   this.s1.username,
      password:   this.s1.password,
      first_name: this.s1.first_name,
      last_name:  this.s1.last_name,
      // Step 2
      store_name:    this.s2.store_name,
      vendor_type:   this.s2.vendor_type,
      description:   this.s2.description,
      phone:         this.s2.phone,
      email:         this.s2.email,
      address:       this.s2.address,
      city:          this.s2.city,
      state:         this.s2.state,
      postal_code:   this.s2.postal_code,
      latitude:      this.s2.latitude || 0,
      longitude:     this.s2.longitude || 0,
      gst_registered: this.s2.gst_registered,
      // Step 3
      legal_name:           this.s3.legal_name || this.s2.store_name,
      contact_person_name:  this.s3.contact_person_name,
      contact_person_email: this.s3.contact_person_email,
      contact_person_phone: this.s3.contact_person_phone,
      pan_number:           this.s3.pan_number.toUpperCase(),
      gstin:                this.s3.gstin.toUpperCase(),
      cin_udyam:            this.s3.cin_udyam,
      fssai_license:        this.s3.fssai_license,
      trademark_number:     this.s3.trademark_number,
      business_addresses:   this.s3.business_addresses,
      // Step 4
      account_holder_name:   this.s4.account_holder_name,
      account_number:        this.s4.account_number,
      ifsc_code:             this.s4.ifsc_code.toUpperCase(),
      bank_name:             this.s4.bank_name,
      branch_name:           this.s4.branch_name,
      account_type:          this.s4.account_type,
      upi_id:                this.s4.upi_id,
      settlement_cycle:      this.s4.settlement_cycle,
      commission_percentage: this.s4.commission_percentage,
      // Step 5
      fulfillment_type:      this.s5.fulfillment_type,
      dispatch_sla_hours:    this.s5.dispatch_sla_hours,
      return_policy:         this.s5.return_policy,
      packaging_preferences: this.s5.packaging_preferences,
      serviceable_pincodes:  this.s5.serviceable_pincodes,
      // Step 6
      opening_time:          this.s6.opening_time,
      closing_time:          this.s6.closing_time,
      min_order_amount:      this.s6.min_order_amount,
      delivery_radius_km:    this.s6.delivery_radius_km,
      auto_order_acceptance: this.s6.auto_order_acceptance,
      cancellation_rules:    this.s6.cancellation_rules,
      vendor_tier:           this.s6.vendor_tier,
      is_open:               this.s6.is_open,
      is_featured:           this.s6.is_featured,
      holidays:              this.s6.holidays,
    };

    this.api.onboardAdminVendor(payload).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (res.auto_generated_password) {
          alert(`Vendor created successfully!\n\nTemporary Password: ${res.auto_generated_password}\n\nPlease share this securely with the vendor. They will be required to change it on their first login.`);
        }
        this.router.navigate(['/vendors']);
      },
      error: (err) => {
        this.saving.set(false);
        const e = err.error;
        if (typeof e === 'object' && !Array.isArray(e)) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(e)) {
            flat[k] = Array.isArray(v) ? (v as string[]).join(' ') : String(v);
          }
          this.fieldErrors.set(flat);
          // navigate to earliest step with error
          const stepFields: Record<number, string[]> = {
            1: ['username', 'password', 'first_name', 'last_name'],
            2: ['store_name', 'vendor_type', 'phone', 'email', 'address', 'city', 'state', 'postal_code'],
            3: ['legal_name', 'pan_number', 'gstin', 'cin_udyam', 'fssai_license'],
            4: ['account_holder_name', 'account_number', 'ifsc_code', 'bank_name', 'settlement_cycle'],
            5: ['fulfillment_type', 'dispatch_sla_hours', 'return_policy'],
            6: ['opening_time', 'closing_time', 'vendor_tier'],
          };
          for (let i = 1; i <= 6; i++) {
            if (stepFields[i].some(f => flat[f])) { this.currentStep.set(i); break; }
          }
          this.error.set('Please fix the errors below and try again.');
        } else {
          this.error.set(typeof e === 'string' ? e : 'Failed to create vendor. Please try again.');
        }
      },
    });
  }

  fieldErr(key: string): string {
    return this.fieldErrors()[key] || '';
  }

  get progressPercent(): number {
    return ((this.currentStep() - 1) / (this.steps.length - 1)) * 100;
  }
}
