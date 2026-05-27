export interface NextouCategory {
  id: string;
  name: string;
  icon: string;
  route?: string;
  source?: unknown;
}

export interface NextouPromotion {
  id: string;
  title: string;
  subtitle: string;
  code?: string;
  icon: string;
  tone: 'purple' | 'green' | 'orange' | 'pink';
}

export interface NextouStore {
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

export interface NextouProduct {
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

export interface NextouHomeState {
  locationLabel: string;
  searchQuery: string;
  cartCount: number;
  categories: NextouCategory[];
  promotions: NextouPromotion[];
  stores: NextouStore[];
  products: NextouProduct[];
}
