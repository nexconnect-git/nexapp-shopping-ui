import { Injectable, inject } from '@angular/core';
import { CurrencyService } from '@shared/public-api';
import {
  DynamicEditConfig,
  DynamicProfileConfig,
  DynamicProfileEntity,
  DynamicReviewConfig,
} from './dynamic-profile.models';

@Injectable({ providedIn: 'root' })
export class DynamicProfileConfigService {
  private readonly currency = inject(CurrencyService);

  /**
   * Replace this mock loader with your API-backed loader:
   * getEntityConfig(entityType: string, id: string)
   */
  getVendorEntity(): DynamicProfileEntity {
    return {
      id: 'VEN-000124',
      type: 'vendor',
      data: {
        storeName: 'Test Shopping Mart',
        storeSlug: 'test-shopping-mart',
        storeType: 'Company',
        primaryCategory: 'Groceries & Staples',
        businessType: 'Private Limited',
        username: 'testvendor',
        firstName: 'Test',
        lastName: 'Vendor',
        email: 'testvendor@app.com',
        phone: '+1 977 848 2372',
        alternatePhone: '+1 (555) 987-6543',
        status: 'Pending',
        storeState: 'Open',
        addressLine1: '123 Market Street',
        addressLine2: 'Suite 100',
        city: 'New York',
        state: 'New York',
        postalCode: '10001',
        country: 'United States',
        minOrder: 150,
        deliveryRadius: 10,
        openingHours: '10:05 AM — 22:11 PM',
        serviceRadius: 10,
        orders: 0,
        catalogItems: 0,
        coverage: '10.00 km',
        totalSales: this.currency.format(0),
        rating: '—',
        passwordTemporary: true,
        joinedOn: 'May 25, 2025',
        lastEdited: 'Today, 10:24 AM',
        role: 'Vendor',
        userId: 'b5698897-99b5-43b4-a4e3-d90001fd184e',
      },
    };
  }

  buildProfileConfig(entity: DynamicProfileEntity): DynamicProfileConfig {
    const d = entity.data;
    return {
      entityName: String(d['storeName'] ?? 'Untitled Profile'),
      entityTypeLabel: String(d['storeType'] ?? entity.type),
      subtitle: `${d['businessType'] ?? 'Business'} • Store ID #${entity.id} • Member since ${d['joinedOn'] ?? '—'}`,
      avatarIcon: '🏪',
      avatarInitials: 'TS',
      breadcrumbs: [
        { label: 'Command Center' },
        { label: 'Stores' },
        { label: 'Profile' },
      ],
      badges: [
        { label: String(d['status'] ?? 'Pending'), tone: 'warning' },
        { label: 'Basic', tone: 'purple' },
        { label: String(d['storeState'] ?? 'Open'), tone: 'success' },
      ],
      actions: [
        { id: 'edit', label: 'Edit Profile', icon: '✎', variant: 'outline' },
        {
          id: 'review',
          label: 'Review & Approve',
          icon: '▣',
          variant: 'primary',
        },
      ],
      tabs: [
        { id: 'overview', label: 'Overview', icon: '▣' },
        { id: 'products', label: 'Products', icon: '📦' },
        { id: 'orders', label: 'Orders', icon: '▥' },
        { id: 'performance', label: 'Sales Report', icon: '📊' },
        { id: 'reviews', label: 'Reviews', icon: '★' },
        { id: 'settings', label: 'Settings', icon: '⚙' },
      ],
      activeTabId: 'overview',
      metrics: [
        {
          label: 'Total Orders',
          value: d['orders'] as number,
          subtext: 'All time',
          icon: '▥',
          tone: 'purple',
        },
        {
          label: 'Catalog Items',
          value: d['catalogItems'] as number,
          subtext: 'Listed products',
          icon: '▣',
          tone: 'purple',
        },
        {
          label: 'Coverage Radius',
          value: String(d['coverage']),
          subtext: 'City not set',
          icon: '📍',
          tone: 'info',
        },
        {
          label: 'GMV (All time)',
          value: String(d['totalSales']),
          subtext: '—',
          icon: '◎',
          tone: 'info',
        },
        {
          label: 'Store Rating',
          value: String(d['rating']),
          subtext: 'No ratings yet',
          icon: '☆',
          tone: 'warning',
        },
      ],
      passwordNotice: {
        enabled: Boolean(d['passwordTemporary']),
        title: 'Temporary password still active',
        message:
          'This vendor has not changed their auto-generated password yet.',
        actionLabel: 'Reset Password',
      },
      checklistTitle: 'Operational Checklist',
      checklistCompletion: 80,
      checklist: [
        {
          label: 'Approval status',
          status: String(d['status'] ?? 'Pending'),
          tone: 'warning',
          completed: false,
        },
        {
          label: 'Contact profile',
          status: 'Email and phone available',
          tone: 'success',
          completed: true,
        },
        {
          label: 'Stock readiness',
          status: 'No daily stock block',
          tone: 'success',
          completed: true,
        },
        {
          label: 'Store details',
          status: 'Completed',
          tone: 'success',
          completed: true,
        },
        {
          label: 'Delivery settings',
          status: 'Completed',
          tone: 'success',
          completed: true,
        },
      ],
      sections: [
        {
          id: 'store',
          title: 'Store Details',
          icon: '🏪',
          editStepId: 'store',
          columns: 2,
          fields: [
            { label: 'Store Type', value: d['storeType'] },
            {
              label: 'Min. Order',
              value: this.currency.format(String(d['minOrder'] ?? 0)),
            },
            {
              label: 'Business Address',
              value: `${d['addressLine1']}, ${d['city']}`,
            },
            { label: 'Delivery Radius', value: `${d['deliveryRadius']} km` },
            { label: 'Opening Hours', value: d['openingHours'] },
            { label: 'Coverage Area', value: 'City not set' },
          ],
        },
        {
          id: 'contact',
          title: 'Contact Details',
          icon: '☎',
          editStepId: 'account',
          columns: 2,
          fields: [
            { label: 'Email', value: d['email'] },
            { label: 'Country', value: 'US' },
            { label: 'Phone', value: d['phone'] },
            { label: 'Preferred Contact', value: 'Email' },
          ],
        },
        {
          id: 'linked-user',
          title: 'Linked User Account',
          icon: '♟',
          columns: 2,
          fields: [
            { label: 'User ID', value: d['userId'] },
            { label: 'Role', value: d['role'] },
            { label: 'Full Name', value: `${d['firstName']} ${d['lastName']}` },
            { label: 'Last Login', value: 'May 25, 2025 10:15 AM' },
            { label: 'Username', value: d['username'] },
          ],
        },
        {
          id: 'delivery',
          title: 'Delivery Settings',
          icon: '🚚',
          editStepId: 'logistics',
          columns: 3,
          fields: [
            { label: 'Delivery Radius', value: `${d['deliveryRadius']} km` },
            {
              label: 'Min. Order',
              value: this.currency.format(String(d['minOrder'] ?? 0)),
            },
            { label: 'Estimated Time', value: '30 – 45 mins' },
            { label: 'Delivery Fee', value: this.currency.format(0) },
          ],
        },
      ],
      activities: [
        {
          title: 'Store created',
          description: 'Initial vendor profile was created',
          timestamp: 'May 25, 2025 • 10:05 AM',
          tone: 'purple',
        },
        {
          title: 'Store details submitted',
          description: 'Basic store information completed',
          timestamp: 'May 25, 2025 • 10:10 AM',
          tone: 'info',
        },
        {
          title: 'Documents uploaded',
          description: 'Compliance files added',
          timestamp: 'May 25, 2025 • 10:12 AM',
          tone: 'success',
        },
        {
          title: 'Pending admin review',
          description: 'Waiting for approval',
          timestamp: 'May 25, 2025 • 10:15 AM',
          tone: 'warning',
        },
      ],
    };
  }

  buildEditConfig(): DynamicEditConfig {
    return {
      title: 'Edit Vendor',
      subtitle:
        'Update vendor account and store details across all required sections.',
      breadcrumbs: [
        { label: 'Command Center' },
        { label: 'Stores' },
        { label: 'Profile' },
        { label: 'Edit' },
      ],
      cancelLabel: 'Cancel',
      saveDraftLabel: 'Save Draft',
      submitLabel: 'Continue',
      steps: [
        {
          id: 'account',
          label: 'Account',
          sections: [
            {
              id: 'accountCredentials',
              title: 'Account Credentials',
              subtitle: 'Create or update the login account for this vendor.',
              icon: '👤',
              columns: 2,
              fields: [
                {
                  key: 'username',
                  label: 'Username',
                  type: 'text',
                  required: true,
                  colSpan: 2,
                  hint: 'This becomes the vendor login ID. Keep it simple and unique.',
                },
                {
                  key: 'firstName',
                  label: 'First Name',
                  type: 'text',
                  required: true,
                },
                {
                  key: 'lastName',
                  label: 'Last Name',
                  type: 'text',
                  required: true,
                },
                { key: 'email', label: 'Email', type: 'email', required: true },
                { key: 'phone', label: 'Phone', type: 'tel', required: true },
              ],
            },
          ],
        },
        {
          id: 'store',
          label: 'Store Info',
          sections: [
            {
              id: 'storeLogo',
              title: 'Store Logo',
              subtitle:
                'This logo will represent the store across the platform.',
              icon: '🏪',
              columns: 1,
              fields: [
                {
                  key: 'logo',
                  label: 'Upload Logo',
                  type: 'file',
                  hint: 'PNG, JPG up to 2MB',
                },
              ],
            },
            {
              id: 'storeBasics',
              title: 'Store Basics',
              subtitle: 'Provide the basic details of your store.',
              icon: '▣',
              columns: 2,
              fields: [
                {
                  key: 'storeName',
                  label: 'Store Name',
                  type: 'text',
                  required: true,
                },
                {
                  key: 'storeSlug',
                  label: 'Store Slug',
                  type: 'text',
                  required: true,
                },
                {
                  key: 'storeType',
                  label: 'Store Type',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Company', value: 'Company' },
                    { label: 'Retailer', value: 'Retailer' },
                    { label: 'Individual', value: 'Individual' },
                  ],
                },
                {
                  key: 'primaryCategory',
                  label: 'Primary Category',
                  type: 'select',
                  required: true,
                  options: [
                    {
                      label: 'Groceries & Staples',
                      value: 'Groceries & Staples',
                    },
                    { label: 'Pharmacy', value: 'Pharmacy' },
                    { label: 'Restaurant', value: 'Restaurant' },
                  ],
                },
              ],
            },
            {
              id: 'address',
              title: 'Address',
              subtitle: 'Physical address of your main store.',
              icon: '📍',
              columns: 2,
              fields: [
                {
                  key: 'addressLine1',
                  label: 'Address Line 1',
                  type: 'text',
                  required: true,
                },
                { key: 'addressLine2', label: 'Address Line 2', type: 'text' },
                { key: 'city', label: 'City', type: 'text', required: true },
                {
                  key: 'state',
                  label: 'State',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'New York', value: 'New York' },
                    { label: 'California', value: 'California' },
                    { label: 'Texas', value: 'Texas' },
                  ],
                },
                {
                  key: 'postalCode',
                  label: 'ZIP Code',
                  type: 'text',
                  required: true,
                },
                {
                  key: 'country',
                  label: 'Country',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'United States', value: 'United States' },
                    { label: 'India', value: 'India' },
                    { label: 'United Kingdom', value: 'United Kingdom' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'compliance',
          label: 'Compliance',
          sections: [
            {
              id: 'business',
              title: 'Business Details',
              subtitle: 'Information about your business.',
              icon: '🏛',
              columns: 2,
              fields: [
                {
                  key: 'businessRegistrationNo',
                  label: 'Business Registration No.',
                  type: 'text',
                },
                { key: 'taxId', label: 'Tax ID / EIN', type: 'text' },
                { key: 'businessSince', label: 'Business Since', type: 'date' },
                { key: 'website', label: 'Website', type: 'text' },
                {
                  key: 'gstVatNumber',
                  label: 'GST / VAT Number',
                  type: 'text',
                },
                {
                  key: 'legalBusinessName',
                  label: 'Legal Business Name',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          id: 'bank',
          label: 'Bank',
          sections: [
            {
              id: 'bankDetails',
              title: 'Bank Details',
              subtitle: 'Payment settlement details.',
              icon: '🏦',
              columns: 2,
              fields: [
                {
                  key: 'accountHolderName',
                  label: 'Account Holder Name',
                  type: 'text',
                },
                { key: 'bankName', label: 'Bank Name', type: 'text' },
                { key: 'accountNumber', label: 'Account Number', type: 'text' },
                {
                  key: 'ifscRoutingCode',
                  label: 'IFSC / Routing Code',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          id: 'logistics',
          label: 'Logistics',
          sections: [
            {
              id: 'serviceRadius',
              title: 'Service Radius',
              subtitle: 'Define the delivery service area for this store.',
              icon: '📍',
              columns: 2,
              fields: [
                {
                  key: 'serviceRadius',
                  label: 'Service Radius',
                  type: 'number',
                  suffix: 'km',
                  required: true,
                },
                {
                  key: 'minOrder',
                  label: 'Minimum Order',
                  type: 'currency',
                  prefix: this.currency.getSymbol(),
                  required: true,
                },
              ],
            },
            {
              id: 'openingHours',
              title: 'Opening Hours',
              subtitle: 'Set the weekly operating hours.',
              icon: '🕘',
              columns: 2,
              fields: [
                { key: 'openingTime', label: 'Opening Time', type: 'time' },
                { key: 'closingTime', label: 'Closing Time', type: 'time' },
              ],
            },
          ],
        },
        {
          id: 'operations',
          label: 'Operations',
          sections: [
            {
              id: 'storeSettings',
              title: 'Store Settings',
              subtitle: 'Configure how the store operates.',
              icon: '⚙',
              columns: 1,
              fields: [
                {
                  key: 'acceptOnlineOrders',
                  label: 'Accept Online Orders',
                  type: 'toggle',
                },
                {
                  key: 'visibleInStorefront',
                  label: 'Visible in Storefront',
                  type: 'toggle',
                },
                {
                  key: 'scheduleOrders',
                  label: 'Schedule Orders',
                  type: 'toggle',
                },
                {
                  key: 'storeActive',
                  label: 'Store is Active',
                  type: 'toggle',
                },
                {
                  key: 'description',
                  label: 'Store Description',
                  type: 'textarea',
                  colSpan: 2,
                },
              ],
            },
          ],
        },
        {
          id: 'review',
          label: 'Review',
          sections: [],
        },
      ],
    };
  }

  buildReviewConfig(entity: DynamicProfileEntity): DynamicReviewConfig {
    const profile = this.buildProfileConfig(entity);
    const d = entity.data;
    return {
      title: 'Review Vendor',
      subtitle: 'Review all details before submitting for approval.',
      breadcrumbs: [
        { label: 'Command Center' },
        { label: 'Stores' },
        { label: 'Profile' },
        { label: 'Review' },
      ],
      profileSummary: {
        ...profile,
        entityName: `${d['firstName']} ${d['lastName']}`,
        entityTypeLabel: String(d['username']),
        avatarInitials: 'TV',
        avatarIcon: undefined,
        badges: [{ label: 'Active', tone: 'success' }],
      },
      completionPercent: 95,
      readinessLabel: 'Ready for Approval',
      readinessTone: 'success',
      warning: {
        enabled: Boolean(d['passwordTemporary']),
        title: 'Action Required: Temporary password is active',
        message:
          'Account will not be fully operational until password is changed.',
        actionLabel: 'Resend Reset Link',
      },
      attentionItems: [
        {
          title: 'Temporary password is active',
          description: 'Ask vendor to reset password',
          tone: 'warning',
        },
      ],
      sections: [
        {
          id: 'account',
          title: 'Account Details',
          icon: '👤',
          editStepId: 'account',
          fields: [
            { label: 'Username', value: d['username'] },
            { label: 'First Name', value: d['firstName'] },
            { label: 'Last Name', value: d['lastName'] },
            { label: 'Email', value: d['email'] },
            { label: 'Phone', value: d['phone'] },
            { label: 'Status', value: d['storeState'], tone: 'success' },
            {
              label: 'Password',
              value: 'Temporary (Not reset)',
              tone: 'danger',
            },
          ],
        },
        {
          id: 'store',
          title: 'Store Information',
          icon: '🏪',
          editStepId: 'store',
          fields: [
            { label: 'Store Name', value: d['storeName'] },
            { label: 'Store Type', value: d['storeType'] },
            { label: 'Business Type', value: d['businessType'] },
            { label: 'GSTIN / Tax ID', value: '27ABCDE1234F1Z5' },
            { label: 'PAN', value: 'ABCDE1234F' },
            { label: 'Website', value: 'www.testvendor.com' },
            { label: 'Store Status', value: 'Active', tone: 'success' },
          ],
        },
        {
          id: 'address',
          title: 'Business Address',
          icon: '📍',
          editStepId: 'store',
          fields: [
            { label: 'Address Line 1', value: d['addressLine1'] },
            { label: 'Address Line 2', value: d['addressLine2'] },
            { label: 'City', value: d['city'] },
            { label: 'State / Province', value: d['state'] },
            { label: 'Postal / ZIP Code', value: d['postalCode'] },
            { label: 'Country', value: d['country'] },
          ],
        },
        {
          id: 'compliance',
          title: 'Compliance / Documents',
          icon: '🛡',
          editStepId: 'compliance',
          fields: [
            { label: 'Business License', value: 'Verified', tone: 'success' },
            { label: 'GST Certificate', value: 'Verified', tone: 'success' },
            { label: 'PAN Card', value: 'Verified', tone: 'success' },
            { label: 'Identity Proof', value: 'Verified', tone: 'success' },
            { label: 'Address Proof', value: 'Verified', tone: 'success' },
            { label: 'Other Documents', value: '2 Uploaded' },
          ],
        },
        {
          id: 'bank',
          title: 'Bank Details',
          icon: '🏦',
          editStepId: 'bank',
          fields: [
            { label: 'Account Holder Name', value: 'Test Vendor LLC' },
            { label: 'Bank Name', value: 'Chase Bank' },
            { label: 'Account Number', value: '•••• •••• •••• 1234' },
            { label: 'IFSC / Routing', value: 'CHASUS33XXX' },
            { label: 'Account Type', value: 'Checking' },
            { label: 'Status', value: 'Verified', tone: 'success' },
          ],
        },
        {
          id: 'logistics',
          title: 'Logistics / Delivery Settings',
          icon: '🚚',
          editStepId: 'logistics',
          fields: [
            { label: 'Default Delivery Type', value: 'Standard' },
            { label: 'Shipping Partner', value: 'NexConnect Logistics' },
            { label: 'Shipping Zones', value: '3 Zones' },
            { label: 'Return Window', value: '7 Days' },
            { label: 'COD Available', value: true, tone: 'success' },
            { label: 'Free Shipping Over', value: this.currency.format(50) },
          ],
        },
      ],
      saveDraftLabel: 'Save Draft',
      submitLabel: 'Submit for Approval',
    };
  }
}
