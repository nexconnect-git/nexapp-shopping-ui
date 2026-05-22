export interface FlashCategory {
  id: string;
  name: string;
  icon: string;
  route?: string;
  source?: unknown;
}

export interface FlashPromotion {
  id: string;
  title: string;
  subtitle: string;
  code?: string;
  icon: string;
  tone: 'purple' | 'green' | 'orange' | 'pink';
}

export interface FlashStore {
  id: string;
  name: string;
  category: string;
  rating: number;
  etaMinutes: number;
  freeDelivery: boolean;
  imageUrl?: string;
  logoText: string;
  logoTone: 'green' | 'black' | 'red' | 'purple';
  rawStore?: unknown;
}

export interface FlashProduct {
  id: string;
  name: string;
  unit: string;
  price: number;
  comparePrice?: number;
  image: string;
  badge?: string;
  category?: string;
  storeId?: string;
  rawProduct?: unknown;
}

export interface FlashHomeState {
  locationLabel: string;
  searchQuery: string;
  cartCount: number;
  categories: FlashCategory[];
  promotions: FlashPromotion[];
  stores: FlashStore[];
  products: FlashProduct[];
}
