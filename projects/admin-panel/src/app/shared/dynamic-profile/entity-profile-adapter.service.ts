import { Injectable } from '@angular/core';
import {
  DynamicEditConfig,
  DynamicProfileConfig,
  DynamicProfileEntity,
  DynamicReviewConfig,
  ProfileBadge,
  ProfileChecklistItem,
  ProfileDisplayField,
  ProfileDisplaySection,
  ProfileFormField,
  ProfileFormSection,
  ProfileHeroAction,
  ProfileMetric,
  ProfileStatusTone,
  ProfileWizardStep,
  ReviewSection,
} from './dynamic-profile.models';

type EntityType =
  | 'vendor'
  | 'store'
  | 'customer'
  | 'admin-user'
  | 'delivery-partner'
  | 'product'
  | 'catalog-product';

@Injectable({ providedIn: 'root' })
export class EntityProfileAdapterService {
  buildProfileConfig(
    entityType: string,
    entityDto: unknown,
  ): DynamicProfileConfig {
    const type = this.normalizeType(entityType);
    const dto = this.asRecord(entityDto);
    const user = this.user(dto, type);

    return {
      entityName: this.entityName(type, dto, user),
      entityTypeLabel: this.entityTypeLabel(type),
      subtitle: this.subtitle(type, dto, user),
      avatarUrl: this.mediaUrl(user['avatar'] ?? dto['logo'] ?? dto['image']),
      avatarIcon: this.entityIcon(type),
      avatarInitials: this.initials(this.entityName(type, dto, user)),
      breadcrumbs: this.breadcrumbs(type, dto, 'Profile'),
      badges: this.badges(type, dto, user),
      actions: this.profileActions(type, dto),
      tabs: [{ id: 'overview', label: 'Overview', icon: '📋' }],
      activeTabId: 'overview',
      metrics: this.metrics(type, dto, user),
      passwordNotice: {
        enabled: Boolean(
          user['force_password_change'] && user['temp_password'],
        ),
        title: 'Temporary password still active',
        message: 'This user has not changed their auto-generated password yet.',
        actionLabel: 'Reset Password',
        secretLabel: 'Temp Password',
        secretValue: this.str(user['temp_password']),
      },
      checklistTitle: this.checklistTitle(type),
      checklistCompletion: this.completion(type, dto, user),
      checklist: this.checklist(type, dto, user),
      sections: this.profileSections(type, dto, user),
      activities: this.activities(type, dto, user),
    };
  }

  buildEditConfig(entityType: string, entityDto: unknown): DynamicEditConfig {
    const type = this.normalizeType(entityType);
    const dto = this.asRecord(entityDto);
    return {
      title: `Edit ${this.entityTypeLabel(type)}`,
      subtitle: `Update ${this.entityName(type, dto, this.user(dto, type))} details.`,
      breadcrumbs: this.breadcrumbs(type, dto, 'Edit'),
      cancelLabel: 'Cancel',
      saveDraftLabel: 'Save Draft',
      submitLabel: 'Continue',
      steps: this.editSteps(type),
    };
  }

  buildReviewConfig(
    entityType: string,
    entityDto: unknown,
  ): DynamicReviewConfig {
    const type = this.normalizeType(entityType);
    const dto = this.asRecord(entityDto);
    const user = this.user(dto, type);
    return {
      title: `Review ${this.entityTypeLabel(type)}`,
      subtitle:
        'Review all mapped details before submitting or applying changes.',
      breadcrumbs: this.breadcrumbs(type, dto, 'Review'),
      profileSummary: this.buildProfileConfig(type, dto),
      completionPercent: this.completion(type, dto, user),
      readinessLabel: this.readiness(type, dto, user),
      readinessTone: this.readinessTone(type, dto, user),
      warning: {
        enabled: Boolean(
          user['force_password_change'] && user['temp_password'],
        ),
        title: 'Action required: temporary password is active',
        message:
          'The user account will not be fully operational until the password is changed.',
        actionLabel: 'Reset Password',
        secretLabel: 'Temp Password',
        secretValue: this.str(user['temp_password']),
      },
      attentionItems: this.attentionItems(type, dto, user),
      sections: this.reviewSections(type, dto, user),
      saveDraftLabel: 'Save Draft',
      submitLabel:
        type === 'vendor' || type === 'store'
          ? 'Approve Vendor'
          : 'Submit Review',
    };
  }

  toUpdatePayload(
    entityType: string,
    formValue: Record<string, unknown>,
  ): unknown {
    const type = this.normalizeType(entityType);
    const value = this.normalizeFormValue(formValue);

    if (type === 'vendor' || type === 'store') {
      const payload = this.pick(value, [
        'username',
        'first_name',
        'last_name',
        'email',
        'phone',
        'store_name',
        'vendor_type',
        'vendor_tier',
        'description',
        'gst_registered',
        'address',
        'city',
        'state',
        'postal_code',
        'latitude',
        'longitude',
        'legal_name',
        'contact_person_name',
        'contact_person_email',
        'contact_person_phone',
        'pan_number',
        'gstin',
        'cin_udyam',
        'fssai_license',
        'trademark_number',
        'business_addresses',
        'account_holder_name',
        'account_number',
        'ifsc_code',
        'bank_name',
        'branch_name',
        'account_type',
        'upi_id',
        'settlement_cycle',
        'commission_percentage',
        'opening_time',
        'closing_time',
        'min_order_amount',
        'delivery_radius_km',
        'serviceable_pincodes',
        'holidays',
        'fulfillment_type',
        'dispatch_sla_hours',
        'return_policy',
        'packaging_preferences',
        'auto_order_acceptance',
        'cancellation_rules',
        'is_open',
        'is_accepting_orders',
        'require_stock_check',
        'is_featured',
      ]);
      return this.withParsedCollections(payload, [
        'business_addresses',
        'serviceable_pincodes',
        'holidays',
      ]);
    }

    if (type === 'customer' || type === 'admin-user') {
      return this.pick(value, [
        'username',
        'first_name',
        'last_name',
        'email',
        'phone',
        'country',
        'is_verified',
        'is_active',
      ]);
    }

    if (type === 'delivery-partner') {
      return this.pick(value, [
        'username',
        'first_name',
        'last_name',
        'email',
        'phone',
        'vehicle_type',
        'vehicle_number',
        'license_number',
        'is_available',
        'is_approved',
        'status',
        'user_is_active',
      ]);
    }

    return this.pick(value, [
      'name',
      'description',
      'brand',
      'sku',
      'price',
      'compare_price',
      'stock',
      'unit',
      'weight',
      'is_available',
      'status',
      'category',
    ]);
  }

  toEntity(entityType: string, entityDto: unknown): DynamicProfileEntity {
    const type = this.normalizeType(entityType);
    const dto = this.asRecord(entityDto);
    return {
      id: this.str(dto['id']) || 'entity',
      type,
      data: this.toFormValue(type, dto),
    };
  }

  toFormValue(entityType: string, entityDto: unknown): Record<string, unknown> {
    const type = this.normalizeType(entityType);
    const dto = this.asRecord(entityDto);
    const user = this.user(dto, type);
    return {
      ...dto,
      username: user['username'] ?? dto['username'] ?? '',
      first_name: user['first_name'] ?? dto['first_name'] ?? '',
      last_name: user['last_name'] ?? dto['last_name'] ?? '',
      email: user['email'] ?? dto['email'] ?? '',
      phone: user['phone'] ?? dto['phone'] ?? '',
      country: user['country'] ?? dto['country'] ?? '',
      user_is_active: user['is_active'] ?? dto['is_active'] ?? true,
      business_addresses: this.collectionText(dto['business_addresses']),
      serviceable_pincodes: this.collectionText(dto['serviceable_pincodes']),
      holidays: this.collectionText(dto['holidays']),
    };
  }

  private profileSections(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): ProfileDisplaySection[] {
    if (type === 'vendor' || type === 'store') {
      return [
        this.section('store', 'Store Details', '🏪', 'store', [
          this.field('Store ID', dto['id']),
          this.field('Store Name', dto['store_name']),
          this.field('Type', dto['vendor_type']),
          this.field('Tier', dto['vendor_tier']),
          this.field('Description', dto['description']),
          this.field('Status', dto['status'], this.statusTone(dto['status'])),
          this.field('Open Now', this.yesNo(dto['is_open'])),
          this.field(
            'Accepting Orders',
            this.yesNo(dto['is_accepting_orders']),
          ),
          this.field('Featured Vendor', this.yesNo(dto['is_featured'])),
        ]),
        this.section(
          'account',
          'Linked User Account',
          '👤',
          'account',
          this.userFields(user),
        ),
        this.section('contact', 'Contact & Address', '📍', 'store', [
          this.field('Email', dto['email'] ?? user['email']),
          this.field('Phone', dto['phone'] ?? user['phone']),
          this.field('Address', dto['address']),
          this.field('City', dto['city']),
          this.field('State', dto['state']),
          this.field('Postal Code', dto['postal_code']),
          this.field('Latitude', dto['latitude']),
          this.field('Longitude', dto['longitude']),
        ]),
        this.section('compliance', 'Legal & Compliance', '🛡️', 'compliance', [
          this.field('Legal Name', dto['legal_name']),
          this.field('GST Registered', this.yesNo(dto['gst_registered'])),
          this.field('PAN Number', dto['pan_number']),
          this.field('GSTIN', dto['gstin']),
          this.field('CIN / Udyam', dto['cin_udyam']),
          this.field('FSSAI License', dto['fssai_license']),
          this.field('Trademark Number', dto['trademark_number']),
          this.field('Contact Person', dto['contact_person_name']),
          this.field('Contact Email', dto['contact_person_email']),
          this.field('Contact Phone', dto['contact_person_phone']),
          this.field('Business Addresses', dto['business_addresses']),
        ]),
        this.section('bank', 'Bank & Settlement', '🏦', 'bank', [
          this.field('Account Holder', dto['account_holder_name']),
          this.field(
            'Masked Account',
            dto['masked_account'] ?? dto['account_number'],
          ),
          this.field('IFSC Code', dto['ifsc_code']),
          this.field('Bank Name', dto['bank_name']),
          this.field('Branch Name', dto['branch_name']),
          this.field('Account Type', dto['account_type']),
          this.field('UPI ID', dto['upi_id']),
          this.field('Settlement Cycle', dto['settlement_cycle']),
          this.field('Commission %', dto['commission_percentage']),
          this.field(
            'Bank Verified',
            this.yesNo(dto['bank_is_verified'] ?? dto['is_verified']),
          ),
        ]),
        this.section(
          'logistics',
          'Logistics & Fulfillment',
          '🚚',
          'logistics',
          [
            this.field('Fulfillment Type', dto['fulfillment_type']),
            this.field(
              'Dispatch SLA',
              this.withSuffix(dto['dispatch_sla_hours'], ' hours'),
            ),
            this.field('Return Policy', dto['return_policy']),
            this.field('Packaging Preferences', dto['packaging_preferences']),
            this.field('Serviceable Pincodes', dto['serviceable_pincodes']),
          ],
        ),
        this.section('operations', 'Operations', '⚙️', 'operations', [
          this.field('Opening Time', dto['opening_time']),
          this.field('Closing Time', dto['closing_time']),
          this.field('Minimum Order', dto['min_order_amount']),
          this.field(
            'Delivery Radius',
            this.withSuffix(dto['delivery_radius_km'], ' km'),
          ),
          this.field(
            'Require Stock Check',
            this.yesNo(dto['require_stock_check']),
          ),
          this.field(
            'Auto Accept Orders',
            this.yesNo(dto['auto_order_acceptance']),
          ),
          this.field('Cancellation Rules', dto['cancellation_rules']),
          this.field('Holiday Calendar', dto['holidays']),
        ]),
      ];
    }

    if (type === 'delivery-partner') {
      return [
        this.section(
          'account',
          'User Account Details',
          '👤',
          'account',
          this.userFields(user),
        ),
        this.section('vehicle', 'Vehicle & License', '🛵', 'vehicle', [
          this.field('Partner ID', dto['id']),
          this.field('Vehicle Type', dto['vehicle_type']),
          this.field('Vehicle Number', dto['vehicle_number']),
          this.field('ID Proof', dto['id_proof']),
          this.field('License Number', dto['license_number']),
          this.field(
            'Approved',
            this.yesNo(dto['is_approved']),
            dto['is_approved'] ? 'success' : 'warning',
          ),
          this.field('Available', this.yesNo(dto['is_available'])),
          this.field('Status', dto['status'], this.statusTone(dto['status'])),
        ]),
        this.section('performance', 'Performance', '📈', undefined, [
          this.field('Average Rating', dto['average_rating']),
          this.field('Total Deliveries', dto['total_deliveries']),
          this.field('Total Earnings', dto['total_earnings']),
          this.field('Wallet Balance', dto['wallet_balance']),
          this.field('Current Latitude', dto['current_latitude']),
          this.field('Current Longitude', dto['current_longitude']),
        ]),
      ];
    }

    if (type === 'product' || type === 'catalog-product') {
      return [
        this.section('product', 'Product Details', '📦', 'product', [
          this.field('Product ID', dto['id']),
          this.field('Name', dto['name']),
          this.field('Brand', dto['brand']),
          this.field('SKU', dto['sku']),
          this.field('Description', dto['description']),
          this.field('Status', dto['status']),
        ]),
        this.section('commerce', 'Commerce', '💰', 'commerce', [
          this.field('Price', dto['price']),
          this.field('Compare Price', dto['compare_price']),
          this.field('Stock', dto['stock']),
          this.field('Unit', dto['unit']),
          this.field('Weight', dto['weight']),
          this.field('Available', this.yesNo(dto['is_available'])),
        ]),
      ];
    }

    return [
      this.section(
        'account',
        'User Account Details',
        '👤',
        'account',
        this.userFields(user),
      ),
      this.section('status', 'Account State', '🛡️', 'account', [
        this.field(
          'Active',
          this.yesNo(user['is_active']),
          user['is_active'] === false ? 'danger' : 'success',
        ),
        this.field(
          'Verified',
          this.yesNo(user['is_verified']),
          user['is_verified'] ? 'success' : 'warning',
        ),
        this.field('Staff', this.yesNo(user['is_staff'])),
        this.field('Superuser', this.yesNo(user['is_superuser'])),
        this.field(
          'Force Password Change',
          this.yesNo(user['force_password_change']),
        ),
      ]),
    ];
  }

  private editSteps(type: EntityType): ProfileWizardStep[] {
    if (type === 'vendor' || type === 'store') {
      return [
        this.step(
          'account',
          'Account',
          [
            this.formSection('account', 'Account Credentials', '👤', [
              this.formField(
                'username',
                'Username',
                'text',
                true,
                2,
                'This becomes the vendor login ID. Keep it simple and unique.',
              ),
              this.formField('first_name', 'First Name', 'text', false),
              this.formField('last_name', 'Last Name', 'text', false),
              this.formField('email', 'Business Email', 'email', true),
              this.formField('phone', 'Phone Number', 'tel', true),
            ]),
          ],
          '👤',
        ),
        this.step(
          'store',
          'Store Info',
          [
            this.formSection('store', 'Store Information', '🏪', [
              this.formField(
                'store_name',
                'Store / Business Name',
                'text',
                true,
              ),
              this.selectField('vendor_type', 'Vendor Type', [
                'individual',
                'company',
                'partnership',
              ]),
              this.formField(
                'description',
                'Description',
                'textarea',
                false,
                2,
              ),
              this.formField('address', 'Address', 'text', false, 2),
              this.formField('city', 'City', 'text', false),
              this.formField('state', 'State', 'text', false),
              this.formField('postal_code', 'Postal Code', 'text', false),
              this.formField('latitude', 'Latitude', 'number', false),
              this.formField('longitude', 'Longitude', 'number', false),
              this.formField(
                'gst_registered',
                'Registered for GST',
                'toggle',
                false,
              ),
            ]),
          ],
          '🏪',
        ),
        this.step(
          'compliance',
          'Compliance',
          [
            this.formSection('compliance', 'Legal & Compliance', '🛡️', [
              this.formField(
                'legal_name',
                'Legal / Business Name',
                'text',
                false,
                2,
              ),
              this.formField('pan_number', 'PAN Number', 'text', false),
              this.formField('gstin', 'GSTIN', 'text', false),
              this.formField(
                'cin_udyam',
                'CIN / Udyam Registration',
                'text',
                false,
              ),
              this.formField('fssai_license', 'FSSAI License', 'text', false),
              this.formField(
                'trademark_number',
                'Trademark Number',
                'text',
                false,
              ),
            ]),
            this.formSection('contact-person', 'Contact Person', '☎️', [
              this.formField(
                'contact_person_name',
                'Contact Person Name',
                'text',
                false,
              ),
              this.formField(
                'contact_person_email',
                'Contact Email',
                'email',
                false,
              ),
              this.formField(
                'contact_person_phone',
                'Contact Phone',
                'tel',
                false,
              ),
              this.formField(
                'business_addresses',
                'Business Addresses',
                'textarea',
                false,
                2,
                'Use JSON array format, for example [{"label":"Warehouse","city":"Mumbai","state":"MH","pincode":"400001"}].',
              ),
            ]),
          ],
          '🛡️',
        ),
        this.step(
          'bank',
          'Bank',
          [
            this.formSection('bank', 'Bank & Payment', '🏦', [
              this.formField(
                'account_holder_name',
                'Account Holder Name',
                'text',
                false,
                2,
              ),
              this.formField('account_number', 'Account Number', 'text', false),
              this.formField('ifsc_code', 'IFSC Code', 'text', false),
              this.formField('bank_name', 'Bank Name', 'text', false),
              this.formField('branch_name', 'Branch Name', 'text', false),
              this.selectField('account_type', 'Account Type', [
                'savings',
                'current',
              ]),
              this.formField('upi_id', 'UPI ID', 'text', false),
              this.selectField('settlement_cycle', 'Settlement Cycle', [
                'T+1',
                'T+7',
                'T+15',
                'T+30',
              ]),
              this.formField(
                'commission_percentage',
                'Commission (%)',
                'number',
                false,
              ),
            ]),
          ],
          '🏦',
        ),
        this.step(
          'logistics',
          'Logistics',
          [
            this.formSection('logistics', 'Logistics & Fulfillment', '🚚', [
              this.selectField('fulfillment_type', 'Fulfillment Type', [
                'vendor',
                'platform',
              ]),
              this.formField(
                'dispatch_sla_hours',
                'Dispatch SLA Hours',
                'number',
                false,
              ),
              this.formField(
                'return_policy',
                'Return Policy',
                'textarea',
                false,
                2,
              ),
              this.formField(
                'packaging_preferences',
                'Packaging Preferences',
                'textarea',
                false,
                2,
              ),
              this.formField(
                'serviceable_pincodes',
                'Serviceable Pincodes',
                'textarea',
                false,
                2,
                'Use JSON array format, for example [{"pincode":"400001","city":"Mumbai","state":"MH"}].',
              ),
            ]),
          ],
          '🚚',
        ),
        this.step(
          'operations',
          'Operations',
          [
            this.formSection('operations', 'Operational Settings', '⚙️', [
              this.formField('opening_time', 'Opening Time', 'time', false),
              this.formField('closing_time', 'Closing Time', 'time', false),
              this.formField(
                'min_order_amount',
                'Min Order Amount',
                'number',
                false,
              ),
              this.formField(
                'delivery_radius_km',
                'Delivery Radius (km)',
                'number',
                false,
              ),
              this.selectField('vendor_tier', 'Vendor Tier', [
                'basic',
                'silver',
                'gold',
                'platinum',
              ]),
              this.formField(
                'cancellation_rules',
                'Cancellation Rules',
                'textarea',
                false,
                2,
              ),
              this.formField('is_open', 'Open for Business', 'toggle', false),
              this.formField(
                'is_accepting_orders',
                'Accept Orders',
                'toggle',
                false,
              ),
              this.formField(
                'require_stock_check',
                'Require Stock Check',
                'toggle',
                false,
              ),
              this.formField(
                'auto_order_acceptance',
                'Auto-Accept Orders',
                'toggle',
                false,
              ),
              this.formField('is_featured', 'Featured Vendor', 'toggle', false),
              this.formField(
                'holidays',
                'Holiday Calendar',
                'textarea',
                false,
                2,
                'Use JSON array format, for example [{"date":"2026-01-26","reason":"Republic Day"}].',
              ),
            ]),
          ],
          '⚙️',
        ),
      ];
    }

    if (type === 'delivery-partner') {
      return [
        this.step('account', 'Account', [this.accountFormSection()], '👤'),
        this.step(
          'vehicle',
          'Vehicle',
          [
            this.formSection('vehicle', 'Vehicle Details', '🛵', [
              this.selectField('vehicle_type', 'Vehicle Type', [
                'bicycle',
                'motorcycle',
                'car',
                'van',
              ]),
              this.formField('vehicle_number', 'Vehicle Number', 'text', false),
              this.formField('license_number', 'License Number', 'text', true),
              this.formField(
                'id_proof',
                'ID Proof',
                'file',
                false,
                2,
                'Upload or replace the partner identity document.',
              ),
              this.formField('is_available', 'Available', 'toggle', false),
              this.formField('is_approved', 'Approved', 'toggle', false),
              this.selectField('status', 'Status', [
                'available',
                'on_delivery',
                'offline',
              ]),
            ]),
          ],
          '🛵',
        ),
      ];
    }

    if (type === 'product' || type === 'catalog-product') {
      return [
        this.step(
          'product',
          'Product',
          [
            this.formSection('product', 'Product Basics', '📦', [
              this.formField('name', 'Name', 'text', true),
              this.formField('brand', 'Brand', 'text', false),
              this.formField('sku', 'SKU', 'text', false),
              this.formField(
                'description',
                'Description',
                'textarea',
                false,
                2,
              ),
            ]),
          ],
          '📦',
        ),
        this.step(
          'commerce',
          'Commerce',
          [
            this.formSection('commerce', 'Price & Stock', '💰', [
              this.formField('price', 'Price', 'currency', true),
              this.formField(
                'compare_price',
                'Compare Price',
                'currency',
                false,
              ),
              this.formField('stock', 'Stock', 'number', false),
              this.formField('unit', 'Unit', 'text', false),
              this.formField('weight', 'Weight', 'text', false),
              this.formField('is_available', 'Available', 'toggle', false),
            ]),
          ],
          '💰',
        ),
      ];
    }

    return [this.step('account', 'Account', [this.accountFormSection()], '👤')];
  }

  private reviewSections(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): ReviewSection[] {
    return this.profileSections(type, dto, user).map((section) => ({
      id: section.id,
      title: section.title,
      icon: section.icon,
      editStepId: section.editStepId,
      fields: section.fields,
    }));
  }

  private userFields(user: Record<string, unknown>): ProfileDisplayField[] {
    return [
      this.field('User ID', user['id']),
      this.field('Username', user['username']),
      this.field(
        'Full Name',
        `${this.str(user['first_name'])} ${this.str(user['last_name'])}`.trim(),
      ),
      this.field('First Name', user['first_name']),
      this.field('Last Name', user['last_name']),
      this.field('Email', user['email']),
      this.field('Phone', user['phone']),
      this.field('Country', user['country']),
      this.field('Role', user['role']),
      this.field(
        'Active',
        this.yesNo(user['is_active']),
        user['is_active'] === false ? 'danger' : 'success',
      ),
      this.field(
        'Verified',
        this.yesNo(user['is_verified']),
        user['is_verified'] ? 'success' : 'warning',
      ),
      this.field('Staff', this.yesNo(user['is_staff'])),
      this.field('Superuser', this.yesNo(user['is_superuser'])),
      this.field(
        'Force Password Change',
        this.yesNo(user['force_password_change']),
      ),
      this.field('Date Joined', user['date_joined']),
      this.field('Created', user['created_at']),
      this.field('Updated', user['updated_at']),
      this.field('Last Login', user['last_login'] || 'Never'),
    ];
  }

  private metrics(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): ProfileMetric[] {
    if (type === 'vendor' || type === 'store') {
      return [
        {
          label: 'Store State',
          value: dto['is_open'] ? 'Open' : 'Closed',
          subtext: `${dto['status'] || 'pending'} account`,
          icon: '🏪',
          tone: dto['is_open'] ? 'success' : 'warning',
        },
        {
          label: 'Orders',
          value: this.num(dto['total_orders']),
          subtext: 'Operational volume',
          icon: '🧾',
          tone: 'purple',
        },
        {
          label: 'Catalog',
          value: this.num(dto['total_products']),
          subtext: 'Listed products',
          icon: '📦',
          tone: 'info',
        },
        {
          label: 'Coverage',
          value: this.withSuffix(dto['delivery_radius_km'] ?? 0, ' km'),
          subtext: this.str(dto['city']) || 'City not set',
          icon: '📍',
          tone: 'neutral',
        },
      ];
    }
    if (type === 'delivery-partner') {
      return [
        {
          label: 'Approval',
          value: dto['is_approved'] ? 'Approved' : 'Pending',
          subtext:
            user['is_active'] === false
              ? 'Suspended account'
              : 'Account active',
          icon: '✅',
          tone: dto['is_approved'] ? 'success' : 'warning',
        },
        {
          label: 'Deliveries',
          value: this.num(dto['total_deliveries']),
          subtext: 'Completed assignments',
          icon: '🚚',
          tone: 'purple',
        },
        {
          label: 'Rating',
          value: this.str(dto['average_rating']) || '0.0',
          subtext: 'Customer score',
          icon: '⭐',
          tone: 'warning',
        },
        {
          label: 'Vehicle',
          value: this.str(dto['vehicle_type']) || 'Vehicle',
          subtext: this.str(dto['vehicle_number']) || 'Plate missing',
          icon: '🛵',
          tone: 'neutral',
        },
      ];
    }
    if (type === 'product' || type === 'catalog-product') {
      return [
        {
          label: 'Price',
          value: this.str(dto['price'] ?? 0),
          subtext: 'Selling price',
          icon: '💰',
          tone: 'purple',
        },
        {
          label: 'Stock',
          value: this.str(dto['stock'] ?? 0),
          subtext: 'Available units',
          icon: '📦',
          tone: 'info',
        },
        {
          label: 'Status',
          value: this.str(
            dto['status'] ?? (dto['is_available'] ? 'Active' : 'Inactive'),
          ),
          subtext: 'Catalog state',
          icon: '✅',
          tone: dto['is_available'] ? 'success' : 'warning',
        },
      ];
    }
    return [
      {
        label: 'Account',
        value: user['is_active'] === false ? 'Suspended' : 'Active',
        subtext: this.str(user['role']) || this.entityTypeLabel(type),
        icon: '👤',
        tone: user['is_active'] === false ? 'danger' : 'success',
      },
      {
        label: 'Verified',
        value: user['is_verified'] ? 'Yes' : 'No',
        subtext: 'Identity status',
        icon: '✅',
        tone: user['is_verified'] ? 'success' : 'warning',
      },
      {
        label: 'Last Login',
        value: this.str(user['last_login']) || 'Never',
        subtext: 'Access activity',
        icon: '🕒',
        tone: 'neutral',
      },
    ];
  }

  private badges(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): ProfileBadge[] {
    if (type === 'vendor' || type === 'store') {
      return [
        {
          label: this.str(dto['status']) || 'pending',
          tone: this.statusTone(dto['status']),
        },
        { label: this.str(dto['vendor_tier']) || 'basic', tone: 'purple' },
        {
          label: dto['is_open'] ? 'Open Now' : 'Closed',
          tone: dto['is_open'] ? 'success' : 'warning',
        },
      ];
    }
    if (type === 'delivery-partner') {
      return [
        {
          label: this.str(dto['status']) || 'offline',
          tone: this.statusTone(dto['status']),
        },
        {
          label: dto['is_approved'] ? 'Approved' : 'Pending',
          tone: dto['is_approved'] ? 'success' : 'warning',
        },
      ];
    }
    return [
      {
        label: this.str(user['role']) || this.entityTypeLabel(type),
        tone: 'purple',
      },
      {
        label: user['is_active'] === false ? 'Suspended' : 'Active',
        tone: user['is_active'] === false ? 'danger' : 'success',
      },
      {
        label: user['is_verified'] ? 'Verified' : 'Unverified',
        tone: user['is_verified'] ? 'success' : 'warning',
      },
    ];
  }

  private profileActions(
    type: EntityType,
    dto: Record<string, unknown>,
  ): ProfileHeroAction[] {
    const actions: ProfileHeroAction[] = [
      { id: 'edit', label: 'Edit', icon: '✏️', variant: 'outline' },
      { id: 'review', label: 'Review', icon: '🧾', variant: 'primary' },
    ];
    if (
      (type === 'vendor' || type === 'store') &&
      dto['status'] !== 'approved'
    ) {
      actions.push({
        id: 'approve',
        label: 'Approve',
        icon: '✅',
        variant: 'soft',
      });
    }
    if (type === 'delivery-partner' && !dto['is_approved']) {
      actions.push({
        id: 'approve',
        label: 'Approve',
        icon: '✅',
        variant: 'soft',
      });
    }
    return actions;
  }

  private attentionItems(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ) {
    const items = [];
    if (user['force_password_change']) {
      items.push({
        title: 'Temporary password is active',
        description: 'Ask the user to reset their password.',
        tone: 'warning' as ProfileStatusTone,
      });
    }
    if (
      (type === 'vendor' || type === 'store') &&
      dto['status'] !== 'approved'
    ) {
      items.push({
        title: 'Vendor not approved',
        description: 'Review details before enabling marketplace operations.',
        tone: 'warning' as ProfileStatusTone,
      });
    }
    if (type === 'delivery-partner' && !dto['is_approved']) {
      items.push({
        title: 'Partner not approved',
        description: 'Partner cannot receive assignments yet.',
        tone: 'warning' as ProfileStatusTone,
      });
    }
    return items;
  }

  private checklist(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): ProfileChecklistItem[] {
    if (type === 'vendor' || type === 'store') {
      return [
        {
          label: 'Approval status',
          status: this.str(dto['status']) || 'pending',
          completed: dto['status'] === 'approved',
          tone: this.statusTone(dto['status']),
        },
        {
          label: 'Contact profile',
          status:
            dto['email'] && dto['phone']
              ? 'Email and phone available'
              : 'Missing contact detail',
          completed: Boolean(dto['email'] && dto['phone']),
          tone: dto['email'] && dto['phone'] ? 'success' : 'warning',
        },
        {
          label: 'Store details',
          status:
            dto['store_name'] && dto['address'] ? 'Completed' : 'Incomplete',
          completed: Boolean(dto['store_name'] && dto['address']),
          tone: dto['store_name'] && dto['address'] ? 'success' : 'warning',
        },
        {
          label: 'Stock readiness',
          status: dto['require_stock_check']
            ? 'Stock check required'
            : 'No daily stock block',
          completed: !dto['require_stock_check'],
          tone: dto['require_stock_check'] ? 'warning' : 'success',
        },
      ];
    }
    return [
      {
        label: 'Account active',
        status: user['is_active'] === false ? 'Suspended' : 'Active',
        completed: user['is_active'] !== false,
        tone: user['is_active'] === false ? 'danger' : 'success',
      },
      {
        label: 'Contact profile',
        status:
          user['email'] || user['phone']
            ? 'Contact available'
            : 'Missing contact detail',
        completed: Boolean(user['email'] || user['phone']),
        tone: user['email'] || user['phone'] ? 'success' : 'warning',
      },
      {
        label: 'Verification',
        status: user['is_verified'] ? 'Verified' : 'Unverified',
        completed: Boolean(user['is_verified']),
        tone: user['is_verified'] ? 'success' : 'warning',
      },
    ];
  }

  private activities(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ) {
    return [
      {
        title: `${this.entityTypeLabel(type)} profile loaded`,
        description:
          'Current admin API details are mapped into the shared dynamic profile system.',
        timestamp:
          this.str(dto['updated_at'] ?? user['updated_at']) ||
          'No update timestamp',
        tone: 'info' as ProfileStatusTone,
      },
      {
        title: 'Account created',
        description:
          this.str(user['username'] ?? dto['username']) || 'Linked account',
        timestamp:
          this.str(
            dto['created_at'] ?? user['created_at'] ?? user['date_joined'],
          ) || 'No creation timestamp',
        tone: 'purple' as ProfileStatusTone,
      },
    ];
  }

  private accountFormSection() {
    return this.formSection('account', 'Account Details', '👤', [
      this.formField('username', 'Username', 'text', true, 2),
      this.formField('first_name', 'First Name', 'text', false),
      this.formField('last_name', 'Last Name', 'text', false),
      this.formField('email', 'Email', 'email', false),
      this.formField('phone', 'Phone', 'tel', false),
      this.formField('country', 'Country', 'text', false),
      this.formField('is_verified', 'Verified', 'toggle', false),
      this.formField('is_active', 'Active', 'toggle', false),
    ]);
  }

  private section(
    id: string,
    title: string,
    icon: string,
    editStepId: string | undefined,
    fields: ProfileDisplayField[],
  ): ProfileDisplaySection {
    return { id, title, icon, editStepId, columns: 2, fields };
  }

  private step(
    id: string,
    label: string,
    sections: ProfileFormSection[],
    icon?: string,
  ): ProfileWizardStep {
    return { id, label, icon, sections };
  }

  private formSection(
    id: string,
    title: string,
    icon: string,
    fields: ProfileFormField[],
  ) {
    return { id, title, icon, columns: 2 as const, fields };
  }

  private formField(
    key: string,
    label: string,
    type: ProfileFormField['type'],
    required = false,
    colSpan: 1 | 2 = 1,
    hint?: string,
  ): ProfileFormField {
    return { key, label, type, required, colSpan, hint };
  }

  private selectField(
    key: string,
    label: string,
    options: string[],
  ): ProfileFormField {
    return {
      key,
      label,
      type: 'select',
      options: options.map((value) => ({ label: this.title(value), value })),
    };
  }

  private field(
    label: string,
    value: unknown,
    tone?: ProfileStatusTone,
  ): ProfileDisplayField {
    return {
      label,
      value:
        value === undefined || value === null || value === '' ? '-' : value,
      tone,
    };
  }

  private user(
    dto: Record<string, unknown>,
    type: EntityType,
  ): Record<string, unknown> {
    if (type === 'vendor' || type === 'store')
      return this.asRecord(dto['user_info']);
    if (type === 'delivery-partner') return this.asRecord(dto['user']);
    return dto;
  }

  private normalizeType(type: string): EntityType {
    const clean = type.toLowerCase();
    if (clean === 'store') return 'store';
    if (
      clean === 'delivery' ||
      clean === 'partner' ||
      clean === 'delivery_partner'
    )
      return 'delivery-partner';
    if (clean === 'admin' || clean === 'admin_user') return 'admin-user';
    if (clean === 'catalog' || clean === 'catalog_product')
      return 'catalog-product';
    if (['vendor', 'customer', 'product'].includes(clean))
      return clean as EntityType;
    return 'customer';
  }

  private entityName(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): string {
    if (type === 'vendor' || type === 'store')
      return (
        this.str(dto['store_name']) || this.str(user['username']) || 'Store'
      );
    if (type === 'product' || type === 'catalog-product')
      return this.str(dto['name']) || 'Product';
    return (
      `${this.str(user['first_name'])} ${this.str(user['last_name'])}`.trim() ||
      this.str(user['username']) ||
      this.entityTypeLabel(type)
    );
  }

  private entityTypeLabel(type: EntityType): string {
    const labels: Record<EntityType, string> = {
      vendor: 'Vendor Store',
      store: 'Vendor Store',
      customer: 'Customer',
      'admin-user': 'Admin User',
      'delivery-partner': 'Delivery Partner',
      product: 'Product',
      'catalog-product': 'Catalog Product',
    };
    return labels[type];
  }

  private subtitle(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): string {
    if (type === 'vendor' || type === 'store')
      return `${this.title(this.str(dto['vendor_type']) || 'store')} - ${this.str(dto['city']) || 'City not set'}`;
    if (type === 'product' || type === 'catalog-product')
      return `${this.str(dto['brand']) || 'Brand not set'} - ${this.str(dto['sku']) || 'No SKU'}`;
    return `@${this.str(user['username']) || 'user'} - ${this.str(user['role']) || this.entityTypeLabel(type)}`;
  }

  private breadcrumbs(
    type: EntityType,
    dto: Record<string, unknown>,
    current: string,
  ) {
    const id = this.str(dto['id']);
    const user = this.user(dto, type);
    const name = this.entityName(type, dto, user);
    if (type === 'vendor' || type === 'store') {
      return [
        { label: 'Command Center', link: '/' },
        { label: 'Stores', link: '/vendors' },
        current === 'Profile'
          ? { label: name }
          : { label: name, link: `/vendors/${id}` },
        ...(current === 'Profile' ? [] : [{ label: current }]),
      ];
    }
    if (type === 'customer') {
      return [
        { label: 'Command Center', link: '/' },
        { label: 'Customers', link: '/customers' },
        current === 'Profile'
          ? { label: name }
          : { label: name, link: `/customers/${id}` },
        ...(current === 'Profile' ? [] : [{ label: current }]),
      ];
    }
    if (type === 'delivery-partner') {
      return [
        { label: 'Command Center', link: '/' },
        { label: 'Dispatch Fleet', link: '/delivery-partners' },
        current === 'Profile'
          ? { label: name }
          : { label: name, link: `/delivery-partners/${id}` },
        ...(current === 'Profile' ? [] : [{ label: current }]),
      ];
    }
    if (type === 'admin-user')
      return [
        { label: 'Command Center', link: '/' },
        { label: 'Admin Profile', link: '/admin/profile' },
        { label: current },
      ];
    return [
      { label: 'Command Center', link: '/' },
      { label: 'Products', link: '/products' },
      { label: id || name },
      ...(current === 'Profile' ? [] : [{ label: current }]),
    ];
  }

  private completion(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): number {
    const checks = this.checklist(type, dto, user);
    if (!checks.length) return 0;
    return Math.round(
      (checks.filter((item) => item.completed).length / checks.length) * 100,
    );
  }

  private checklistTitle(type: EntityType): string {
    return type === 'vendor' || type === 'store'
      ? 'Operational Checklist'
      : 'Account Checklist';
  }

  private readiness(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): string {
    if ((type === 'vendor' || type === 'store') && dto['status'] !== 'approved')
      return 'Needs Approval';
    if (type === 'delivery-partner' && !dto['is_approved'])
      return 'Needs Approval';
    if (user['is_active'] === false) return 'Suspended';
    return 'Ready';
  }

  private readinessTone(
    type: EntityType,
    dto: Record<string, unknown>,
    user: Record<string, unknown>,
  ): ProfileStatusTone {
    const label = this.readiness(type, dto, user);
    if (label === 'Ready') return 'success';
    if (label === 'Suspended') return 'danger';
    return 'warning';
  }

  private statusTone(value: unknown): ProfileStatusTone {
    const status = this.str(value).toLowerCase();
    if (['approved', 'active', 'available', 'delivered'].includes(status))
      return 'success';
    if (['rejected', 'suspended', 'cancelled', 'offline'].includes(status))
      return 'danger';
    if (['pending', 'on_delivery', 'preparing'].includes(status))
      return 'warning';
    return 'neutral';
  }

  private pick(
    source: Record<string, unknown>,
    keys: string[],
  ): Record<string, unknown> {
    return keys.reduce<Record<string, unknown>>((payload, key) => {
      if (source[key] !== undefined) payload[key] = source[key];
      return payload;
    }, {});
  }

  private normalizeFormValue(
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const value = { ...source };
    for (const key of Object.keys(value)) {
      if (typeof value[key] === 'string')
        value[key] = String(value[key]).trim();
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
      if (value[key]) value[key] = String(value[key]).toUpperCase();
    }
    for (const key of [
      'latitude',
      'longitude',
      'commission_percentage',
      'min_order_amount',
      'delivery_radius_km',
      'dispatch_sla_hours',
      'price',
      'compare_price',
      'stock',
    ]) {
      if (value[key] !== undefined && value[key] !== '')
        value[key] = Number(value[key]);
    }
    return value;
  }

  private withParsedCollections(
    payload: Record<string, unknown>,
    keys: string[],
  ): Record<string, unknown> {
    const next = { ...payload };
    for (const key of keys) {
      if (key in next) next[key] = this.parseCollection(next[key]);
    }
    return next;
  }

  private parseCollection(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'string') return [];
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ value: line }));
    }
  }

  private collectionText(value: unknown): string {
    if (Array.isArray(value))
      return value.length ? JSON.stringify(value, null, 2) : '';
    if (value && typeof value === 'object')
      return JSON.stringify(value, null, 2);
    return this.str(value);
  }

  private entityIcon(type: EntityType): string {
    const icons: Record<EntityType, string> = {
      vendor: '🏪',
      store: '🏪',
      customer: '🛒',
      'admin-user': '🛡️',
      'delivery-partner': '🛵',
      product: '📦',
      'catalog-product': '📦',
    };
    return icons[type];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private str(value: unknown): string {
    return value === undefined || value === null ? '' : String(value);
  }

  private mediaUrl(value: unknown): string {
    const url = this.str(value);
    if (!url || url.startsWith('/')) return '';
    return url;
  }

  private num(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private yesNo(value: unknown): string {
    return value ? 'Yes' : 'No';
  }

  private withSuffix(value: unknown, suffix: string): string {
    const text = this.str(value);
    return text ? `${text}${suffix}` : `0${suffix}`;
  }

  private initials(value: string): string {
    return (
      value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'NC'
    );
  }

  private title(value: string): string {
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
