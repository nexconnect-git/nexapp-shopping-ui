import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '@shared/public-api';
import {
  DynamicStepperComponent,
  StepperConfig,
  StepperField,
  StepperSection,
  UniqueValidationResult,
} from '../../shared/components/dynamic-stepper/dynamic-stepper.component';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,30}$/;
const INDIA_PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9._-]{2,64}$/;
const VEHICLE_NUMBER_PATTERN = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

const VENDOR_STORE_TYPE_OPTIONS = [
  { value: 'wholesale_store', label: 'Wholesale Store' },
  { value: 'retail_store', label: 'Retail Store' },
  { value: 'kirana_store', label: 'Kirana Store' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'hypermarket', label: 'Hypermarket' },
  { value: 'department_store', label: 'Department Store' },
  { value: 'specialty_store', label: 'Specialty Store' },
  { value: 'convenience_store', label: 'Convenience Store' },
  { value: 'discount_store', label: 'Discount Store' },
  { value: 'franchise_store', label: 'Franchise Store' },
  { value: 'chain_store', label: 'Chain Store' },
  { value: 'online_store', label: 'Online Store / E-commerce' },
  { value: 'street_vendor', label: 'Street Vendor / Hawker' },
  { value: 'mandi_market_yard', label: 'Mandi / Market Yard' },
  { value: 'b2b_store', label: 'B2B Store' },
];

function normalizeVendorStoreType(value: unknown): string {
  const raw = String(value || '').trim();
  if (VENDOR_STORE_TYPE_OPTIONS.some((option) => option.value === raw)) {
    return raw;
  }
  if (['individual', 'company', 'partnership'].includes(raw)) {
    return 'retail_store';
  }
  return 'retail_store';
}

@Component({
  selector: 'app-onboarding-form',
  standalone: true,
  imports: [CommonModule, DynamicStepperComponent],
  templateUrl: './onboarding-form.component.html',
  styleUrl: './onboarding-form.component.scss',
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

  uniqueChecker = (
    field: StepperField,
    value: string,
  ): Observable<UniqueValidationResult> => {
    return this.api.checkAdminIdentityAvailability({
      field: field.key,
      value,
      exclude_user_id: this.prefillData()?.['user_id'] || '',
      role: this.mode === 'partner-onboard' ? 'delivery' : 'vendor',
    });
  };

  private readonly VENDOR_DOCUMENT_SECTION: StepperSection = {
    title: 'Documents',
    description: 'Upload the required licence and KYC files collected during onboarding.',
    fields: [
      {
        key: 'license_document',
        label: 'Business / Trade License',
        type: 'file',
        required: true,
        accept: DOCUMENT_ACCEPT,
        hint: 'PDF or image file.',
      },
      {
        key: 'pan_card_document',
        label: 'PAN Card',
        type: 'file',
        required: true,
        accept: DOCUMENT_ACCEPT,
      },
      {
        key: 'identity_proof_document',
        label: 'Identity Proof',
        type: 'file',
        required: true,
        accept: DOCUMENT_ACCEPT,
      },
      {
        key: 'address_proof_document',
        label: 'Address Proof',
        type: 'file',
        required: true,
        accept: DOCUMENT_ACCEPT,
      },
      {
        key: 'cancelled_cheque_document',
        label: 'Cancelled Cheque',
        type: 'file',
        required: true,
        accept: DOCUMENT_ACCEPT,
      },
      {
        key: 'gstin_certificate_document',
        label: 'GSTIN Certificate',
        type: 'file',
        optional: true,
        accept: DOCUMENT_ACCEPT,
        hint: 'Required when GST registration is enabled.',
      },
      {
        key: 'fssai_license_document',
        label: 'FSSAI License',
        type: 'file',
        optional: true,
        accept: DOCUMENT_ACCEPT,
      },
      {
        key: 'business_registration_document',
        label: 'CIN / Udyam Certificate',
        type: 'file',
        optional: true,
        accept: DOCUMENT_ACCEPT,
      },
      {
        key: 'trademark_document',
        label: 'Trademark Certificate',
        type: 'file',
        optional: true,
        accept: DOCUMENT_ACCEPT,
      },
    ],
  };

  private readonly VENDOR_CONFIG: StepperConfig = {
    title: 'Onboard New Vendor',
    subtitle:
      'Complete all steps to create and submit the vendor account for review.',
    submitLabel: 'Submit & Create Vendor',
    steps: [
      {
        label: 'Account',
        title: 'Account Credentials',
        subtitle: 'Create the login account for this vendor.',
        sections: [
          {
            fields: [
              {
                key: 'username',
                label: 'Username',
                type: 'text',
                required: true,
                unique: true,
                placeholder: 'e.g. vendor_john',
                fullWidth: true,
                minLength: 3,
                maxLength: 30,
                pattern: USERNAME_PATTERN,
                patternMessage:
                  'Use 3-30 letters, numbers, dots, dashes, or underscores.',
                hint: 'This becomes the vendor login ID. Keep it simple and unique.',
              },
              {
                key: 'first_name',
                label: 'First Name',
                type: 'text',
                placeholder: 'John',
                maxLength: 40,
              },
              {
                key: 'last_name',
                label: 'Last Name',
                type: 'text',
                placeholder: 'Doe',
                maxLength: 40,
              },
            ],
          },
        ],
      },
      {
        label: 'Store Info',
        title: 'Store Information',
        subtitle: 'Business details and store location.',
        sections: [
          {
            fields: [
              {
                key: 'store_name',
                label: 'Store / Business Name',
                type: 'text',
                required: true,
                placeholder: 'e.g. FreshMart',
                minLength: 2,
                maxLength: 120,
                hint: 'Use the name customers and operations teams will recognize.',
              },
              {
                key: 'vendor_type',
                label: 'Shop Type',
                type: 'select',
                options: VENDOR_STORE_TYPE_OPTIONS,
                defaultValue: 'retail_store',
                hint: 'Used to unlock shop-specific features such as B2B and wholesale flows.',
              },
              {
                key: 'email',
                label: 'Business Email',
                type: 'email',
                required: true,
                unique: true,
                placeholder: 'store@email.com',
                maxLength: 120,
                inputMode: 'email',
              },
              {
                key: 'phone',
                label: 'Phone Number',
                type: 'tel',
                required: true,
                unique: true,
                placeholder: '+91 9876543210',
                inputMode: 'tel',
                hint: 'Use a reachable operations contact number.',
              },
              {
                key: 'description',
                label: 'Description',
                type: 'textarea',
                placeholder: 'Brief description…',
              },
              {
                key: 'logo',
                label: 'Profile Image',
                type: 'file',
                accept: 'image/*',
                hint: 'Square store logo or profile image shown on storefront cards.',
              },
              {
                key: 'banner',
                label: 'Cover Image',
                type: 'file',
                accept: 'image/*',
                hint: 'Wide cover image for the vendor profile header.',
              },
              {
                key: 'address',
                label: 'Address',
                type: 'text',
                fullWidth: true,
                placeholder: 'Street address',
              },
              {
                key: 'city',
                label: 'City',
                type: 'text',
                placeholder: 'Mumbai',
              },
              {
                key: 'state',
                label: 'State',
                type: 'text',
                placeholder: 'Maharashtra',
              },
              {
                key: 'postal_code',
                label: 'Postal Code',
                type: 'text',
                placeholder: '400001',
                pattern: INDIA_PINCODE_PATTERN,
                patternMessage: 'Enter a valid 6-digit pincode.',
                inputMode: 'numeric',
                maxLength: 6,
              },
              {
                key: 'location',
                label: 'Store Location',
                type: 'map',
                fullWidth: true,
                hint: 'Pick the exact store location. Address, city, state, pincode and country update automatically.',
              },
              {
                key: 'gst_registered',
                label: 'Registered for GST',
                type: 'checkbox',
              },
            ],
          },
        ],
      },
      {
        label: 'Compliance',
        title: 'Legal & Compliance',
        subtitle: 'Identity, registration numbers, and contact person.',
        sections: [
          {
            fields: [
              {
                key: 'legal_name',
                label: 'Legal / Business Name',
                type: 'text',
                placeholder: 'Registered legal name',
                maxLength: 160,
              },
              {
                key: 'pan_number',
                label: 'PAN Number',
                type: 'text',
                placeholder: 'ABCDE1234F',
                maxLength: 10,
                uppercase: true,
                pattern: PAN_PATTERN,
                patternMessage: 'PAN must look like ABCDE1234F.',
              },
              {
                key: 'gstin',
                label: 'GSTIN',
                type: 'text',
                placeholder: '15-character GSTIN',
                maxLength: 15,
                uppercase: true,
                pattern: GSTIN_PATTERN,
                patternMessage: 'Enter a valid 15-character GSTIN.',
              },
              {
                key: 'cin_udyam',
                label: 'CIN / Udyam Registration',
                type: 'text',
                placeholder: 'CIN or Udyam number',
                maxLength: 40,
                uppercase: true,
              },
              {
                key: 'fssai_license',
                label: 'FSSAI License',
                type: 'text',
                optional: true,
                placeholder: 'FSSAI licence number',
                maxLength: 20,
                inputMode: 'numeric',
              },
              {
                key: 'trademark_number',
                label: 'Trademark Number',
                type: 'text',
                optional: true,
                placeholder: 'Trademark registration no.',
                maxLength: 40,
                uppercase: true,
              },
            ],
          },
          {
            title: 'Contact Person',
            fields: [
              {
                key: 'contact_person_name',
                label: 'Contact Person Name',
                type: 'text',
                placeholder: 'Full name',
                maxLength: 80,
              },
              {
                key: 'contact_person_email',
                label: 'Contact Email',
                type: 'email',
                placeholder: 'contact@business.com',
                inputMode: 'email',
              },
              {
                key: 'contact_person_phone',
                label: 'Contact Phone',
                type: 'tel',
                placeholder: '+91 XXXXXXXXXX',
                inputMode: 'tel',
              },
            ],
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
                {
                  key: 'label',
                  label: 'Label',
                  type: 'text',
                  required: true,
                  placeholder: 'e.g. Warehouse',
                  maxLength: 50,
                },
                {
                  key: 'street',
                  label: 'Street',
                  type: 'text',
                  placeholder: 'Street',
                  maxLength: 160,
                },
                {
                  key: 'city',
                  label: 'City',
                  type: 'text',
                  placeholder: 'City',
                  maxLength: 80,
                },
                {
                  key: 'state',
                  label: 'State',
                  type: 'text',
                  placeholder: 'State',
                  maxLength: 80,
                },
                {
                  key: 'pincode',
                  label: 'Pincode',
                  type: 'text',
                  placeholder: 'Zip code',
                  pattern: INDIA_PINCODE_PATTERN,
                  patternMessage: 'Enter a valid 6-digit pincode.',
                  inputMode: 'numeric',
                  maxLength: 6,
                },
              ],
            },
          },
        ],
      },
      {
        label: 'Bank',
        title: 'Bank & Payment',
        subtitle: 'Settlement account and commission configuration.',
        sections: [
          {
            fields: [
              {
                key: 'account_holder_name',
                label: 'Account Holder Name',
                type: 'text',
                fullWidth: true,
                placeholder: 'Name as per bank records',
                maxLength: 120,
              },
              {
                key: 'account_number',
                label: 'Account Number',
                type: 'text',
                placeholder: 'Stored encrypted',
                minLength: 6,
                maxLength: 20,
                inputMode: 'numeric',
              },
              {
                key: 'ifsc_code',
                label: 'IFSC Code',
                type: 'text',
                placeholder: 'e.g. SBIN0001234',
                uppercase: true,
                pattern: IFSC_PATTERN,
                patternMessage: 'IFSC must look like SBIN0001234.',
              },
              {
                key: 'bank_name',
                label: 'Bank Name',
                type: 'text',
                placeholder: 'State Bank of India',
                maxLength: 120,
              },
              {
                key: 'branch_name',
                label: 'Branch Name',
                type: 'text',
                placeholder: 'Branch area',
                maxLength: 120,
              },
              {
                key: 'account_type',
                label: 'Account Type',
                type: 'select',
                defaultValue: 'current',
                options: [
                  { value: 'savings', label: 'Savings' },
                  { value: 'current', label: 'Current' },
                ],
              },
              {
                key: 'upi_id',
                label: 'UPI ID',
                type: 'text',
                optional: true,
                placeholder: 'vendor@upi',
                pattern: UPI_PATTERN,
                patternMessage: 'Enter a valid UPI ID, for example vendor@upi.',
              },
              {
                key: 'settlement_cycle',
                label: 'Settlement Cycle',
                type: 'select',
                defaultValue: 'T+7',
                options: [
                  { value: 'T+1', label: 'T+1 (Next Day)' },
                  { value: 'T+7', label: 'T+7 (Weekly)' },
                  { value: 'T+15', label: 'T+15 (Fortnightly)' },
                  { value: 'T+30', label: 'T+30 (Monthly)' },
                ],
              },
              {
                key: 'commission_percentage',
                label: 'Commission (%)',
                type: 'number',
                placeholder: '12.5',
                min: 0,
                max: 100,
                inputMode: 'decimal',
              },
            ],
          },
        ],
      },
      {
        label: 'Logistics',
        title: 'Logistics & Fulfillment',
        subtitle: 'Delivery type, SLA, and serviceable pincodes.',
        sections: [
          {
            fields: [
              {
                key: 'fulfillment_type',
                label: 'Fulfillment Type',
                type: 'select',
                options: [
                  { value: 'vendor', label: 'Vendor Fulfilled' },
                  { value: 'platform', label: 'Platform Fulfilled' },
                ],
              },
              {
                key: 'dispatch_sla_hours',
                label: 'Dispatch SLA (hours)',
                type: 'number',
                placeholder: '24',
                min: 0,
                max: 168,
                inputMode: 'decimal',
              },
              {
                key: 'return_policy',
                label: 'Return Policy',
                type: 'textarea',
                placeholder: 'Describe the return policy…',
              },
              {
                key: 'packaging_preferences',
                label: 'Packaging Preferences',
                type: 'textarea',
                placeholder: 'Packaging requirements…',
              },
            ],
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
                {
                  key: 'pincode',
                  label: 'Pincode',
                  type: 'text',
                  required: true,
                  placeholder: 'Pincode',
                  pattern: INDIA_PINCODE_PATTERN,
                  patternMessage: 'Enter a valid 6-digit pincode.',
                  inputMode: 'numeric',
                  maxLength: 6,
                },
                {
                  key: 'city',
                  label: 'City',
                  type: 'text',
                  placeholder: 'City',
                  maxLength: 80,
                },
                {
                  key: 'state',
                  label: 'State',
                  type: 'text',
                  placeholder: 'State',
                  maxLength: 80,
                },
              ],
            },
          },
        ],
      },
      {
        label: 'Operations',
        title: 'Operational Settings',
        subtitle: 'Store hours, order rules, tier, and holiday calendar.',
        sections: [
          {
            fields: [
              {
                key: 'opening_time',
                label: 'Opening Time',
                type: 'time',
                defaultValue: '09:00',
              },
              {
                key: 'closing_time',
                label: 'Closing Time',
                type: 'time',
                defaultValue: '22:00',
              },
              {
                key: 'min_order_amount',
                label: 'Min Order Amount',
                type: 'number',
                defaultValue: 0,
                placeholder: '0',
                min: 0,
                max: 100000,
                inputMode: 'decimal',
              },
              {
                key: 'delivery_radius_km',
                label: 'Delivery Radius (km)',
                type: 'number',
                defaultValue: 5,
                placeholder: '5',
                min: 0,
                max: 100,
                inputMode: 'decimal',
              },
              {
                key: 'vendor_tier',
                label: 'Vendor Tier',
                type: 'select',
                options: [
                  { value: 'basic', label: 'Basic' },
                  { value: 'silver', label: 'Silver' },
                  { value: 'gold', label: 'Gold' },
                  { value: 'platinum', label: 'Platinum' },
                ],
              },
              {
                key: 'cancellation_rules',
                label: 'Cancellation Rules',
                type: 'textarea',
                placeholder: 'Describe cancellation policy…',
              },
              {
                key: 'is_open',
                label: 'Open for Business',
                type: 'checkbox',
                defaultValue: true,
              },
              {
                key: 'auto_order_acceptance',
                label: 'Auto-Accept Orders',
                type: 'checkbox',
              },
              {
                key: 'is_featured',
                label: 'Featured Vendor',
                type: 'checkbox',
              },
            ],
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
                { key: 'date', label: 'Date', type: 'date', required: true },
                {
                  key: 'reason',
                  label: 'Reason',
                  type: 'text',
                  placeholder: 'Public holiday',
                  maxLength: 80,
                },
              ],
            },
          },
        ],
      },
    ],
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
        sections: [
          {
            fields: [
              {
                key: 'username',
                label: 'Username',
                type: 'text',
                required: true,
                unique: true,
                placeholder: 'e.g. rider_john',
                fullWidth: true,
                minLength: 3,
                maxLength: 30,
                pattern: USERNAME_PATTERN,
                patternMessage:
                  'Use 3-30 letters, numbers, dots, dashes, or underscores.',
              },
              {
                key: 'first_name',
                label: 'First Name',
                type: 'text',
                placeholder: 'John',
                maxLength: 40,
              },
              {
                key: 'last_name',
                label: 'Last Name',
                type: 'text',
                placeholder: 'Doe',
                maxLength: 40,
              },
              {
                key: 'email',
                label: 'Email',
                type: 'email',
                required: true,
                unique: true,
                placeholder: 'rider@email.com',
                maxLength: 120,
                inputMode: 'email',
              },
              {
                key: 'phone',
                label: 'Phone',
                type: 'tel',
                required: true,
                unique: true,
                placeholder: '+91 9876543210',
                inputMode: 'tel',
              },
            ],
          },
        ],
      },
      {
        label: 'Vehicle',
        title: 'Vehicle Details',
        subtitle: 'Vehicle and licence information.',
        sections: [
          {
            fields: [
              {
                key: 'vehicle_type',
                label: 'Vehicle Type',
                type: 'select',
                required: true,
                options: [
                  { value: 'bicycle', label: 'Bicycle' },
                  { value: 'motorcycle', label: 'Motorcycle' },
                  { value: 'car', label: 'Car' },
                  { value: 'van', label: 'Van' },
                ],
              },
              {
                key: 'vehicle_number',
                label: 'Vehicle Number',
                type: 'text',
                placeholder: 'e.g. MH12AB1234',
                uppercase: true,
                pattern: VEHICLE_NUMBER_PATTERN,
                patternMessage:
                  'Use a valid vehicle number, for example MH12AB1234.',
              },
              {
                key: 'license_number',
                label: 'License Number',
                type: 'text',
                required: true,
                placeholder: 'Driving licence no.',
                minLength: 5,
                maxLength: 30,
                uppercase: true,
              },
              {
                key: 'id_proof',
                label: 'ID / Licence Proof',
                type: 'file',
                required: true,
                accept: DOCUMENT_ACCEPT,
                hint: 'Upload a PDF or image collected during onboarding.',
              },
            ],
          },
        ],
      },
    ],
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
        submitLabel: 'Save Changes',
      };
      this.loadVendorData(id);
    } else {
      this.mode = 'vendor-onboard';
      this.stepperConfig = this.withVendorDocumentSection(this.VENDOR_CONFIG);
    }
  }

  private withVendorDocumentSection(config: StepperConfig): StepperConfig {
    return {
      ...config,
      steps: config.steps.map((step) =>
        step.label === 'Compliance'
          ? {
              ...step,
              sections: [...step.sections, this.VENDOR_DOCUMENT_SECTION],
            }
          : step,
      ),
    };
  }

  private loadVendorData(id: string) {
    this.loading.set(true);
    this.api.getAdminVendor(id).subscribe({
      next: (vendor: any) => {
        this.loading.set(false);
        this.prefillData.set({
          // User Info
          user_id: vendor.user_info?.id || vendor.user || '',
          username: vendor.user_info?.username || '',
          first_name: vendor.user_info?.first_name || '',
          last_name: vendor.user_info?.last_name || '',

          // Store Info
          store_name: vendor.store_name || '',
          vendor_type: normalizeVendorStoreType(vendor.vendor_type),
          email: vendor.email || '',
          phone: vendor.phone || '',
          description: vendor.description || '',
          address: vendor.address || '',
          city: vendor.city || '',
          state: vendor.state || '',
          postal_code: vendor.postal_code || '',
          latitude: vendor.latitude || null,
          longitude: vendor.longitude || null,
          country: vendor.user_info?.country || vendor.country || 'IN',

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
      },
    });
  }

  onSubmit(model: any) {
    if (this.saving()) return;

    this.errors.set({});
    const payload = this.normalizePayload(model);
    const clientErrors = this.validatePayload(payload);
    if (Object.keys(clientErrors).length > 0) {
      this.errors.set(clientErrors);
      return;
    }

    this.saving.set(true);

    if (this.mode === 'vendor-onboard' || this.mode === 'vendor-edit') {
      payload.latitude = payload.latitude || 0;
      payload.longitude = payload.longitude || 0;
      payload.commission_percentage = Number(
        payload.commission_percentage || 0,
      );
      payload.min_order_amount = Number(payload.min_order_amount || 0);
      payload.delivery_radius_km = Number(payload.delivery_radius_km || 0);
      payload.dispatch_sla_hours = Number(payload.dispatch_sla_hours || 0);
    }
    if (this.mode === 'partner-onboard') {
      delete payload.latitude;
      delete payload.longitude;
      delete payload.address;
      delete payload.city;
      delete payload.state;
      delete payload.postal_code;
      delete payload.country;
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
        const temporaryPassword = this.extractTemporaryPassword(res);
        if (temporaryPassword) {
          this.tempPassword.set(temporaryPassword);
        } else {
          // Edit mode or no temp password — redirect automatically
          const dest =
            this.mode === 'vendor-edit'
              ? `/vendors/${this.entityId}`
              : this.mode === 'partner-onboard'
                ? '/delivery-partners'
                : '/vendors';
          setTimeout(() => this.router.navigate([dest]), 1800);
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.errors.set(
          err.error || {
            detail: 'Submission failed. Please check all fields.',
          },
        );
      },
    });
  }

  private extractTemporaryPassword(res: any): string {
    return (
      res?.temp_password ||
      res?.temporary_password ||
      res?.auto_generated_password ||
      res?.user?.temp_password ||
      res?.user_info?.temp_password ||
      ''
    );
  }

  copyTempPassword() {
    const pw = this.tempPassword();
    if (pw) navigator.clipboard.writeText(pw);
  }

  proceedAfterPassword() {
    const dest =
      this.mode === 'partner-onboard' ? '/delivery-partners' : '/vendors';
    this.router.navigate([dest]);
  }

  private normalizePayload(model: any) {
    const payload = { ...model };
    for (const key of Object.keys(payload)) {
      if (typeof payload[key] === 'string') payload[key] = payload[key].trim();
    }

    for (const key of [
      'pan_number',
      'gstin',
      'ifsc_code',
      'cin_udyam',
      'trademark_number',
      'vehicle_number',
      'license_number',
    ]) {
      if (payload[key])
        payload[key] = String(payload[key]).trim().toUpperCase();
    }
    payload.vendor_type = normalizeVendorStoreType(payload.vendor_type);
    payload.country = payload.country || 'IN';
    for (const imageKey of ['logo', 'banner']) {
      if (typeof File === 'undefined' || !(payload[imageKey] instanceof File)) {
        delete payload[imageKey];
      }
    }

    return payload;
  }

  private validatePayload(payload: any): Record<string, string> {
    const nextErrors: Record<string, string> = {};

    if (this.mode === 'vendor-onboard' || this.mode === 'vendor-edit') {
      if (payload.gst_registered && !payload.gstin) {
        nextErrors['gstin'] =
          'GSTIN is required when the vendor is marked as GST registered.';
      }
      if (
        this.mode === 'vendor-onboard' &&
        payload.gst_registered &&
        (typeof File === 'undefined' ||
          !(payload.gstin_certificate_document instanceof File))
      ) {
        nextErrors['gstin_certificate_document'] =
          'GSTIN certificate is required when the vendor is marked as GST registered.';
      }
      const latitude = Number(payload.latitude);
      const longitude = Number(payload.longitude);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        (latitude === 0 && longitude === 0)
      ) {
        nextErrors['location'] = 'Pick the store location on the map.';
      }
      if (
        payload.opening_time &&
        payload.closing_time &&
        payload.opening_time >= payload.closing_time
      ) {
        nextErrors['closing_time'] =
          'Closing time must be later than opening time.';
      }
      if (payload.account_number && !payload.ifsc_code) {
        nextErrors['ifsc_code'] =
          'IFSC code is required when account number is provided.';
      }
      if (payload.ifsc_code && !payload.account_number) {
        nextErrors['account_number'] =
          'Account number is required when IFSC code is provided.';
      }
    }

    return nextErrors;
  }

  onCancel() {
    if (this.mode === 'partner-onboard')
      this.router.navigate(['/delivery-partners']);
    else if (this.mode === 'vendor-edit')
      this.router.navigate([`/vendors/${this.entityId}`]);
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
    if (this.mode === 'vendor-edit')
      return 'Update vendor account and store details.';
    if (this.mode === 'partner-onboard')
      return 'Complete all steps to create the delivery partner account.';
    return 'Complete all steps to create and submit the vendor account for review.';
  }
}
