export type ManagedAppId =
  | 'vendor-app'
  | 'delivery-app'
  | 'customer-app'
  | 'mobile-customer';
export type PageStatus = 'enabled' | 'disabled' | 'partial';
export type FeatureStatus = 'enabled' | 'disabled';

export interface ManagedFeature {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  locked?: boolean;
}

export interface ManagedPage {
  id: string;
  appId: ManagedAppId;
  name: string;
  description: string;
  route: string;
  status: PageStatus;
  protected?: boolean;
  redirected?: boolean;
  legacy?: boolean;
  lastUpdated: string;
  features: ManagedFeature[];
}

export interface ManagedApplication {
  id: ManagedAppId;
  name: string;
  description: string;
  icon: string;
  color: 'green' | 'blue' | 'orange' | 'purple';
  pages: ManagedPage[];
}

export interface PageFeatureStats {
  totalApplications: number;
  totalPages: number;
  enabledPages: number;
  disabledPages: number;
  partialPages: number;
}

export interface PageSettingsForm {
  displayName: string;
  route: string;
  icon: string;
  description: string;
  status: PageStatus;
  protected: boolean;
}

export interface ClonePageForm {
  name: string;
  route: string;
  copyFeatures: boolean;
}
