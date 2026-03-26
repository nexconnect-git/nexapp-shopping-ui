import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicStepperComponent, StepperConfig } from '../../shared/components/dynamic-stepper/dynamic-stepper.component';

@Component({
  selector: 'app-vendor-onboard',
  standalone: true,
  imports: [CommonModule, DynamicStepperComponent],
  templateUrl: './vendor-onboard.component.html',
  styleUrl: './vendor-onboard.component.scss'
})
export class VendorOnboardComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  saving = signal(false);
  errors = signal<Record<string, string>>({});
  success = signal(false);

  stepperConfig: StepperConfig = {
    title: 'Onboard New Vendor',
    subtitle: 'Complete all steps to create and submit the vendor account for review.',
    submitLabel: 'Submit & Create Vendor',
    steps: [
      {
        label: 'Account',
        title: 'Account Credentials',
        subtitle: 'Create the login account for this vendor.',
        sections: [
          {
            fields: [
              { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'e.g. vendor_john', fullWidth: true },
              { key: 'first_name', label: 'First Name', type: 'text', placeholder: 'John' },
              { key: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
              { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Min. 8 characters', minLength: 8 },
              { key: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true, placeholder: 'Repeat password' }
            ]
          }
        ]
      },
      {
        label: 'Store Info',
        title: 'Store Information',
        subtitle: 'Business details and store location.',
        sections: [
          {
            fields: [
              { key: 'store_name', label: 'Store / Business Name', type: 'text', required: true, placeholder: 'e.g. FreshMart' },
              { key: 'vendor_type', label: 'Vendor Type', type: 'select', options: [
                { value: 'individual', label: 'Individual' },
                { value: 'company', label: 'Company' },
                { value: 'partnership', label: 'Partnership' }
              ]},
              { key: 'email', label: 'Business Email', type: 'email', required: true, placeholder: 'store@email.com' },
              { key: 'phone', label: 'Phone Number', type: 'tel', required: true, placeholder: '+91 9876543210' },
              { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description of the business…' },
              { key: 'address', label: 'Address', type: 'text', fullWidth: true, placeholder: 'Street address' },
              { key: 'city', label: 'City', type: 'text', placeholder: 'Mumbai' },
              { key: 'state', label: 'State', type: 'text', placeholder: 'Maharashtra' },
              { key: 'postal_code', label: 'Postal Code', type: 'text', placeholder: '400001' },
              { key: 'latitude', label: 'Latitude', type: 'number', placeholder: '19.076090' },
              { key: 'longitude', label: 'Longitude', type: 'number', placeholder: '72.877426' },
              { key: 'gst_registered', label: 'Registered for GST', type: 'checkbox' }
            ]
          }
        ]
      },
      {
        label: 'Compliance',
        title: 'Legal & Compliance',
        subtitle: 'Identity, registration numbers, and contact person.',
        sections: [
          {
            fields: [
              { key: 'legal_name', label: 'Legal / Business Name', type: 'text', placeholder: 'Registered legal name' },
              { key: 'pan_number', label: 'PAN Number', type: 'text', placeholder: 'ABCDE1234F', maxLength: 10, pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, patternMessage: 'Invalid PAN format.' },
              { key: 'gstin', label: 'GSTIN', type: 'text', placeholder: '15-character GSTIN', maxLength: 15 },
              { key: 'cin_udyam', label: 'CIN / Udyam Registration', type: 'text', placeholder: 'CIN or Udyam number' },
              { key: 'fssai_license', label: 'FSSAI License (food vendors)', type: 'text', optional: true, placeholder: 'FSSAI licence number' },
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
                { key: 'street', label: 'Street', type: 'text', placeholder: 'Street mapping' },
                { key: 'city', label: 'City', type: 'text', placeholder: 'City' },
                { key: 'state', label: 'State', type: 'text', placeholder: 'State' },
                { key: 'pincode', label: 'Pincode', type: 'text', placeholder: 'Zip code' }
              ]
            }
          }
        ]
      },
      {
        label: 'Bank details',
        title: 'Bank & Payment',
        subtitle: 'Settlement account and commission configuration.',
        sections: [
          {
            fields: [
              { key: 'account_holder_name', label: 'Account Holder Name', type: 'text', fullWidth: true, placeholder: 'Name as per bank records' },
              { key: 'account_number', label: 'Account Number', type: 'text', placeholder: 'Stored encrypted at rest' },
              { key: 'ifsc_code', label: 'IFSC Code', type: 'text', placeholder: 'e.g. SBIN0001234', pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/, patternMessage: 'Invalid IFSC layout.' },
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
              { key: 'commission_percentage', label: 'Commission Percentage (%)', type: 'number', placeholder: '12.5', min: 0, max: 100 }
            ]
          }
        ]
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
              { key: 'min_order_amount', label: 'Min Order Amount (₦)', type: 'number', placeholder: '0' },
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

  onSubmit(model: any) {
    if (this.saving()) return;
    
    // Validate passwords
    if (model.password !== model.confirmPassword) {
      this.errors.set({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    this.saving.set(true);
    this.errors.set({});

    const payload = { ...model };
    
    // Fix numbers
    payload.latitude = payload.latitude || 0;
    payload.longitude = payload.longitude || 0;
    payload.commission_percentage = Number(payload.commission_percentage || 0);
    payload.min_order_amount = Number(payload.min_order_amount || 0);
    payload.delivery_radius_km = Number(payload.delivery_radius_km || 0);
    payload.dispatch_sla_hours = Number(payload.dispatch_sla_hours || 0);

    // Remove the confirm password from payload
    delete payload.confirmPassword;

    this.api.onboardVendor(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/vendors']), 2000);
      },
      error: (err) => {
        this.saving.set(false);
        this.errors.set(err.error || { detail: 'Submission failed. Please check all fields.' });
      }
    });
  }

  onCancel() {
    this.router.navigate(['/vendors']);
  }
}
