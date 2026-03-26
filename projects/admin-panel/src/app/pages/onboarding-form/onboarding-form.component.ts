import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicStepperComponent, StepperConfig } from '../../shared/components/dynamic-stepper/dynamic-stepper.component';

@Component({
  selector: 'app-onboarding-form',
  standalone: true,
  imports: [CommonModule, DynamicStepperComponent, RouterLink],
  templateUrl: './onboarding-form.component.html',
  styleUrl: './onboarding-form.component.scss'
})
export class OnboardingFormComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  mode: 'vendor-onboard' | 'vendor-edit' | 'partner-onboard' = 'vendor-onboard';
  entityId: string | null = null;

  saving = signal(false);
  errors = signal<Record<string, string>>({});
  success = signal(false);
  loading = signal(false);
  prefillData = signal<Record<string, any> | null>(null);
  tempPassword = signal<string | null>(null);

  stepperConfig!: StepperConfig;

  private readonly VENDOR_CONFIG: StepperConfig = {
    title: 'Onboard New Vendor',
    subtitle: 'Complete all steps to create and submit the vendor account for review.',
    submitLabel: 'Submit & Create Vendor',
    steps: [
      {
        label: 'Account',
        title: 'Account Credentials',
        subtitle: 'Create the login account for this vendor.',
        sections: [{
          fields: [
            { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'e.g. vendor_john', fullWidth: true },
            { key: 'first_name', label: 'First Name', type: 'text', placeholder: 'John' },
            { key: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' }
          ]
        }]
      },
      {
        label: 'Store Info',
        title: 'Store Information',
        subtitle: 'Business details and store location.',
        sections: [{
          fields: [
            { key: 'store_name', label: 'Store / Business Name', type: 'text', required: true, placeholder: 'e.g. FreshMart' },
            { key: 'vendor_type', label: 'Vendor Type', type: 'select', options: [
              { value: 'individual', label: 'Individual' },
              { value: 'company', label: 'Company' },
              { value: 'partnership', label: 'Partnership' }
            ]},
            { key: 'email', label: 'Business Email', type: 'email', required: true, placeholder: 'store@email.com' },
            { key: 'phone', label: 'Phone Number', type: 'tel', required: true, placeholder: '+91 9876543210' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description…' },
            { key: 'address', label: 'Address', type: 'text', fullWidth: true, placeholder: 'Street address' },
            { key: 'city', label: 'City', type: 'text', placeholder: 'Mumbai' },
            { key: 'state', label: 'State', type: 'text', placeholder: 'Maharashtra' },
            { key: 'postal_code', label: 'Postal Code', type: 'text', placeholder: '400001' },
            { key: 'latitude', label: 'Latitude', type: 'number', placeholder: '19.076090' },
            { key: 'longitude', label: 'Longitude', type: 'number', placeholder: '72.877426' },
            { key: 'gst_registered', label: 'Registered for GST', type: 'checkbox' }
          ]
        }]
      },
      {
        label: 'Compliance',
        title: 'Legal & Compliance',
        subtitle: 'Identity, registration numbers, and contact person.',
        sections: [
          {
            fields: [
              { key: 'legal_name', label: 'Legal / Business Name', type: 'text', placeholder: 'Registered legal name' },
              { key: 'pan_number', label: 'PAN Number', type: 'text', placeholder: 'ABCDE1234F', maxLength: 10 },
              { key: 'gstin', label: 'GSTIN', type: 'text', placeholder: '15-character GSTIN', maxLength: 15 },
              { key: 'cin_udyam', label: 'CIN / Udyam Registration', type: 'text', placeholder: 'CIN or Udyam number' },
              { key: 'fssai_license', label: 'FSSAI License', type: 'text', optional: true, placeholder: 'FSSAI licence number' },
              { key: 'trademark_number', label: 'Trademark Number', type: 'text', optional: true, placeholder: 'Trademark registration no.' }
            ]
          },
          {
            title: 'Contact Person',
            fields: [
              { key: 'contact_person_name', label: 'Contact Person Name', type: 'text', placeholder: 'Full name' },
              { key: 'contact_person_email', label: 'Contact Email', type: 'email', placeholder: 'contact@business.com' },
              { key: 'contact_person_phone', label: 'Contact Phone', type: 'tel', placeholder: '+91 XXXXXXXXXX' }
            ]
          },
          {
            title: 'Business Addresses',
            description: 'Optional additional operating addresses.',
            list: {
              key: 'business_addresses',
              title: 'Business Addresses',
              addLabel: 'Add Address',
              itemTitleKey: 'label',
              itemSubtitleKeys: ['city', 'state'],
              fields: [
                { key: 'label', label: 'Label', type: 'text', placeholder: 'e.g. Warehouse' },
                { key: 'street', label: 'Street', type: 'text', placeholder: 'Street' },
                { key: 'city', label: 'City', type: 'text', placeholder: 'City' },
                { key: 'state', label: 'State', type: 'text', placeholder: 'State' },
                { key: 'pincode', label: 'Pincode', type: 'text', placeholder: 'Zip code' }
              ]
            }
          }
        ]
      },
      {
        label: 'Bank',
        title: 'Bank & Payment',
        subtitle: 'Settlement account and commission configuration.',
        sections: [{
          fields: [
            { key: 'account_holder_name', label: 'Account Holder Name', type: 'text', fullWidth: true, placeholder: 'Name as per bank records' },
            { key: 'account_number', label: 'Account Number', type: 'text', placeholder: 'Stored encrypted' },
            { key: 'ifsc_code', label: 'IFSC Code', type: 'text', placeholder: 'e.g. SBIN0001234' },
            { key: 'bank_name', label: 'Bank Name', type: 'text', placeholder: 'State Bank of India' },
            { key: 'branch_name', label: 'Branch Name', type: 'text', placeholder: 'Branch area' },
            { key: 'account_type', label: 'Account Type', type: 'select', options: [
              { value: 'savings', label: 'Savings' },
              { value: 'current', label: 'Current' }
            ]},
            { key: 'upi_id', label: 'UPI ID', type: 'text', optional: true, placeholder: 'vendor@upi' },
            { key: 'settlement_cycle', label: 'Settlement Cycle', type: 'select', options: [
              { value: 'T+1', label: 'T+1 (Next Day)' },
              { value: 'T+7', label: 'T+7 (Weekly)' },
              { value: 'T+15', label: 'T+15 (Fortnightly)' },
              { value: 'T+30', label: 'T+30 (Monthly)' }
            ]},
            { key: 'commission_percentage', label: 'Commission (%)', type: 'number', placeholder: '12.5', min: 0, max: 100 }
          ]
        }]
      },
      {
        label: 'Logistics',
        title: 'Logistics & Fulfillment',
        subtitle: 'Delivery type, SLA, and serviceable pincodes.',
        sections: [
          {
            fields: [
              { key: 'fulfillment_type', label: 'Fulfillment Type', type: 'select', options: [
                { value: 'vendor', label: 'Vendor Fulfilled' },
                { value: 'platform', label: 'Platform Fulfilled' }
              ]},
              { key: 'dispatch_sla_hours', label: 'Dispatch SLA (hours)', type: 'number', placeholder: '24' },
              { key: 'return_policy', label: 'Return Policy', type: 'textarea', placeholder: 'Describe the return policy…' },
              { key: 'packaging_preferences', label: 'Packaging Preferences', type: 'textarea', placeholder: 'Packaging requirements…' }
            ]
          },
          {
            title: 'Serviceable Pincodes',
            list: {
              key: 'serviceable_pincodes',
              title: 'Pincodes',
              addLabel: 'Add Pincode',
              itemTitleKey: 'pincode',
              itemSubtitleKeys: ['city'],
              fields: [
                { key: 'pincode', label: 'Pincode', type: 'text', placeholder: 'Pincode' },
                { key: 'city', label: 'City', type: 'text', placeholder: 'City' },
                { key: 'state', label: 'State', type: 'text', placeholder: 'State' }
              ]
            }
          }
        ]
      },
      {
        label: 'Operations',
        title: 'Operational Settings',
        subtitle: 'Store hours, order rules, tier, and holiday calendar.',
        sections: [
          {
            fields: [
              { key: 'opening_time', label: 'Opening Time', type: 'time' },
              { key: 'closing_time', label: 'Closing Time', type: 'time' },
              { key: 'min_order_amount', label: 'Min Order Amount', type: 'number', placeholder: '0' },
              { key: 'delivery_radius_km', label: 'Delivery Radius (km)', type: 'number', placeholder: '5' },
              { key: 'vendor_tier', label: 'Vendor Tier', type: 'select', options: [
                { value: 'basic', label: 'Basic' },
                { value: 'silver', label: 'Silver' },
                { value: 'gold', label: 'Gold' },
                { value: 'platinum', label: 'Platinum' }
              ]},
              { key: 'cancellation_rules', label: 'Cancellation Rules', type: 'textarea', placeholder: 'Describe cancellation policy…' },
              { key: 'is_open', label: 'Open for Business', type: 'checkbox' },
              { key: 'auto_order_acceptance', label: 'Auto-Accept Orders', type: 'checkbox' },
              { key: 'is_featured', label: 'Featured Vendor', type: 'checkbox' }
            ]
          },
          {
            title: 'Holiday Calendar',
            list: {
              key: 'holidays',
              title: 'Holidays',
              addLabel: 'Add Holiday',
              itemTitleKey: 'date',
              itemSubtitleKeys: ['reason'],
              fields: [
                { key: 'date', label: 'Date', type: 'date' },
                { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Public holiday' }
              ]
            }
          }
        ]
      }
    ]
  };

  private readonly PARTNER_CONFIG: StepperConfig = {
    title: 'Onboard Delivery Partner',
    subtitle: 'Create a new delivery partner account.',
    submitLabel: 'Create Delivery Partner',
    steps: [
      {
        label: 'Account',
        title: 'Account Details',
        subtitle: 'Basic login and personal information.',
        sections: [{
          fields: [
            { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'e.g. rider_john', fullWidth: true },
            { key: 'first_name', label: 'First Name', type: 'text', placeholder: 'John' },
            { key: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
            { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'rider@email.com' },
            { key: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '+91 9876543210' }
          ]
        }]
      },
      {
        label: 'Vehicle',
        title: 'Vehicle Details',
        subtitle: 'Vehicle and licence information.',
        sections: [{
          fields: [
            { key: 'vehicle_type', label: 'Vehicle Type', type: 'select', required: true, options: [
              { value: 'bicycle', label: 'Bicycle' },
              { value: 'motorcycle', label: 'Motorcycle' },
              { value: 'car', label: 'Car' },
              { value: 'van', label: 'Van' }
            ]},
            { key: 'vehicle_number', label: 'Vehicle Number', type: 'text', placeholder: 'e.g. MH12AB1234' },
            { key: 'license_number', label: 'License Number', type: 'text', required: true, placeholder: 'Driving licence no.' }
          ]
        }]
      },
      {
        label: 'Notes',
        title: 'Assignment Notes',
        subtitle: 'Optional notes about area or assignment.',
        sections: [{
          fields: [
            { key: 'assigned_area', label: 'Assigned Area', type: 'text', placeholder: 'e.g. South Mumbai', fullWidth: true },
            { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any additional notes…' }
          ]
        }]
      }
    ]
  };

  ngOnInit() {
    const url = this.router.url;
    const id = this.route.snapshot.paramMap.get('id');

    if (url.includes('delivery-partners/onboard')) {
      this.mode = 'partner-onboard';
      this.stepperConfig = this.PARTNER_CONFIG;
    } else if (id && url.includes('/edit')) {
      this.mode = 'vendor-edit';
      this.entityId = id;
      this.stepperConfig = {
        ...this.VENDOR_CONFIG,
        title: 'Edit Vendor',
        subtitle: 'Update vendor information.',
        submitLabel: 'Save Changes'
      };
      this.loadVendorData(id);
    } else {
      this.mode = 'vendor-onboard';
      this.stepperConfig = this.VENDOR_CONFIG;
    }
  }

  private loadVendorData(id: string) {
    this.loading.set(true);
    this.api.getAdminVendor(id).subscribe({
      next: (vendor: any) => {
        this.loading.set(false);
        this.prefillData.set({
          // User Info
          username: vendor.user_info?.username || '',
          first_name: vendor.user_info?.first_name || '',
          last_name: vendor.user_info?.last_name || '',

          // Store Info
          store_name: vendor.store_name || '',
          vendor_type: vendor.vendor_type || 'individual',
          email: vendor.email || '',
          phone: vendor.phone || '',
          description: vendor.description || '',
          address: vendor.address || '',
          city: vendor.city || '',
          state: vendor.state || '',
          postal_code: vendor.postal_code || '',
          latitude: vendor.latitude || null,
          longitude: vendor.longitude || null,

          // Logistics
          fulfillment_type: vendor.fulfillment_type || 'vendor',
          dispatch_sla_hours: vendor.dispatch_sla_hours || null,
          return_policy: vendor.return_policy || '',
          packaging_preferences: vendor.packaging_preferences || '',

          // Operations
          opening_time: vendor.opening_time || '',
          closing_time: vendor.closing_time || '',
          min_order_amount: vendor.min_order_amount || null,
          delivery_radius_km: vendor.delivery_radius_km || null,
          vendor_tier: vendor.vendor_tier || 'basic',
          cancellation_rules: vendor.cancellation_rules || '',
          is_open: vendor.is_open ?? true,
          auto_order_acceptance: vendor.auto_order_acceptance || false,
          is_featured: vendor.is_featured || false,
        });
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  onSubmit(model: any) {
    if (this.saving()) return;

    this.saving.set(true);
    this.errors.set({});
    const payload = { ...model };

    if (this.mode === 'vendor-onboard' || this.mode === 'vendor-edit') {
      payload.latitude = payload.latitude || 0;
      payload.longitude = payload.longitude || 0;
      payload.commission_percentage = Number(payload.commission_percentage || 0);
      payload.min_order_amount = Number(payload.min_order_amount || 0);
      payload.delivery_radius_km = Number(payload.delivery_radius_km || 0);
      payload.dispatch_sla_hours = Number(payload.dispatch_sla_hours || 0);
    }

    let request$;
    if (this.mode === 'vendor-onboard') {
      request$ = this.api.onboardVendor(payload);
    } else if (this.mode === 'vendor-edit') {
      request$ = this.api.updateAdminVendor(this.entityId!, payload);
    } else {
      request$ = this.api.createAdminDeliveryPartner(payload);
    }

    request$.subscribe({
      next: (res: any) => {
        this.saving.set(false);
        this.success.set(true);
        if (res?.temp_password) {
          this.tempPassword.set(res.temp_password);
        } else {
          // Edit mode or no temp password — redirect automatically
          const dest = this.mode === 'vendor-edit' ? `/vendors/${this.entityId}` :
                       this.mode === 'partner-onboard' ? '/delivery-partners' : '/vendors';
          setTimeout(() => this.router.navigate([dest]), 1800);
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.errors.set(err.error || { detail: 'Submission failed. Please check all fields.' });
      }
    });
  }

  copyTempPassword() {
    const pw = this.tempPassword();
    if (pw) navigator.clipboard.writeText(pw);
  }

  proceedAfterPassword() {
    const dest = this.mode === 'partner-onboard' ? '/delivery-partners' : '/vendors';
    this.router.navigate([dest]);
  }

  onCancel() {
    if (this.mode === 'partner-onboard') this.router.navigate(['/delivery-partners']);
    else if (this.mode === 'vendor-edit') this.router.navigate([`/vendors/${this.entityId}`]);
    else this.router.navigate(['/vendors']);
  }

  get pageTitle(): string {
    if (this.mode === 'vendor-edit') return 'Edit Vendor';
    if (this.mode === 'partner-onboard') return 'Onboard Delivery Partner';
    return 'Onboard New Vendor';
  }

  get backPath(): string {
    if (this.mode === 'partner-onboard') return '/delivery-partners';
    if (this.mode === 'vendor-edit') return `/vendors/${this.entityId}`;
    return '/vendors';
  }

  get backLabel(): string {
    if (this.mode === 'partner-onboard') return 'Delivery Partners';
    if (this.mode === 'vendor-edit') return 'Vendor Profile';
    return 'Vendors';
  }

  get pageSubtitle(): string {
    if (this.mode === 'vendor-edit') return 'Update vendor account and store details.';
    if (this.mode === 'partner-onboard') return 'Complete all steps to create the delivery partner account.';
    return 'Complete all steps to create and submit the vendor account for review.';
  }
}
