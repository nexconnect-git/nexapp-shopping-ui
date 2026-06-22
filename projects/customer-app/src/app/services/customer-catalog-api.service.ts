import { inject, Injectable } from '@angular/core';
import { CustomerApiClientService } from './customer-api-client.service';

@Injectable({ providedIn: 'root' })
export class CustomerCatalogApiService {
  private api = inject(CustomerApiClientService);

  getHome(params?: Record<string, any>) {
    return this.api.toObservable<any>(this.api.client.catalog.home(params));
  }

  checkServiceability(params?: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.catalog.serviceability(params),
    );
  }

  explore(params?: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.catalog.explore(params),
    );
  }

  buyAgain(params?: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.catalog.buyAgain(params),
    );
  }

  getBanners() {
    return this.api.toObservable<any>(this.api.client.catalog.banners());
  }

  getCoupons() {
    return this.api.toObservable<any>(this.api.client.catalog.coupons());
  }

  getCategories(params?: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.catalog.categories(params),
    );
  }

  getProducts(params?: Record<string, any>) {
    return this.api.toObservable<any>(this.api.client.catalog.products(params));
  }

  getProduct(productId: string) {
    return this.api.toObservable<any>(
      this.api.client.catalog.product(productId),
    );
  }

  getVendors(params: Record<string, any>) {
    return this.api.toObservable<any>(this.api.client.catalog.vendors(params));
  }

  getNearbyVendors(
    lat: number,
    lng: number,
    radius?: number,
    category?: string,
    state?: string,
    city?: string,
    postalCode?: string,
  ) {
    return this.api.toObservable<any>(
      this.api.client.catalog.nearbyVendors({
        lat,
        lng,
        radius_km: radius,
        category,
        state,
        city,
        postal_code: postalCode,
      }),
    );
  }

  globalShopSearch(params: {
    lat: number;
    lng: number;
    state: string;
    city?: string;
    postal_code?: string;
    product_query: string;
  }) {
    return this.api.toObservable<any>(
      this.api.client.catalog.globalShopSearch(params),
    );
  }

  productSearchByLocation(params: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.catalog.productSearchByLocation(params),
    );
  }

  vendorRecommendations(vendorId: string, params?: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.catalog.vendorRecommendations(vendorId, params),
    );
  }

  getVendor(vendorId: string, params?: Record<string, any>) {
    return this.api.toObservable<any>(
      this.api.client.catalog.vendor(vendorId, params),
    );
  }
}
