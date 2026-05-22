export interface VendorStoreSettings {
  storeName: string;
  description: string;
  phone: string;
  email: string;
  storeOpen: boolean;
  acceptingOrders: boolean;
  autoAcceptOrders: boolean;
  openingTime: string;
  closingTime: string;
  minimumOrder: number;
  basePrepMinutes: number;
  deliveryRadiusKm: number;
  instantRadiusKm: number;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  packagingPreferences: string;
  cancellationRules: string;
}

export interface StoreSettingsStatusCard {
  label: string;
  value: string;
  caption: string;
  icon: string;
  tone: 'purple' | 'green' | 'orange' | 'blue';
}

export interface StoreLocationSuggestion {
  label: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}
