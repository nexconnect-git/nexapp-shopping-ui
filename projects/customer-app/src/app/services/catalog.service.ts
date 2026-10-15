import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  listFromResponse,
  normalizeBanner as normalizeSharedBanner,
  normalizeCategory as normalizeSharedCategory,
  normalizeCoupon as normalizeSharedCoupon,
  normalizeKey,
  normalizeProduct as normalizeSharedProduct,
  normalizeVendor as normalizeSharedVendor,
  searchProducts,
  searchVendors,
} from '@nexconnect/customer-core';
import {
  buildStoreDiscoveryQueryPlan,
  parseMultiSearchQuery,
} from '@nexconnect/customer-search';
import { normalizeRecommendationResponse } from '@nexconnect/customer-products';
import type {
  Category as ApiCategory,
  Product as ApiProduct,
  Vendor as ApiVendor,
} from '@shared/lib/models';
import { finalize } from 'rxjs';
import {
  Category,
  CustomerCoupon,
  CustomerHomeHero,
  CustomerHomeSection,
  PlatformBanner,
  Product,
  Store,
} from '../models';
import { CustomerCatalogApiService } from './customer-catalog-api.service';
import { AuthService } from './auth.service';

const FALLBACK_PRODUCT_IMAGE = '/assets/placeholders/product.svg';
const FALLBACK_STORE_IMAGE = '/assets/placeholders/store.svg';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(CustomerCatalogApiService);
  private readonly auth = inject(AuthService);
  private homeSession = this.auth.sessionVersion;
  constructor() {
    effect(() => {
      this.auth.currentUser();
      const session = this.auth.sessionVersion;
      if (session === this.homeSession) return;
      this.homeSession = session;
      untracked(() => {
        ++this.homeRequest;
        this.productDetailRequests.clear();
        this.productDetailLoading.set({});
        this._buyAgainProducts.set([]);
        this._products.set([]);
        this.homeResolved.set(false);
        if (Object.keys(this.homeParams).length) this.loadHome(this.homeParams);
      });
    });
  }
  private readonly _categories = signal<Category[]>([]);
  private readonly _stores = signal<Store[]>([]);
  readonly storeResults = signal<Store[]>([]);
  readonly homeStores = signal<Store[]>([]);
  private readonly _products = signal<Product[]>([]);
  private readonly _buyAgainProducts = signal<Product[]>([]);
  private readonly _recommendedProducts = signal<Product[]>([]);
  private readonly _storeProducts = signal<Record<string, Product[]>>({});
  private readonly _banners = signal<PlatformBanner[]>([]);
  private readonly _coupons = signal<CustomerCoupon[]>([]);
  private readonly _homeHero = signal<CustomerHomeHero | null>(null);
  private readonly _homeSections = signal<CustomerHomeSection[]>([]);
  private readonly _categoryLoadingRequests = signal(0);
  private readonly _storeLoadingRequests = signal(0);
  private readonly _productLoadingRequests = signal(0);
  private readonly _storeProductLoadingRequests = signal<
    Record<string, string>
  >({});
  private readonly loadedStoreRequestKeys = new Map<string, string>();
  private storeRequestSequence = 0;
  private storeDetailSequence = 0;
  private catalogContext = 0;
  private categoryRequest = 0;
  private recommendationRequest = 0;
  private searchRequest = 0;
  private readonly productDetailRequests = new Map<string, {sequence:number;context:string}>();
  private productDetailSequence = 0;
  readonly productDetailLoading = signal<Record<string, boolean>>({});
  private lastStoreFilters: Record<string, any> = {};
  private nextStorePage = signal<number | null>(null);
  private lastSearchQuery = '';

  readonly storeErrors = signal<Record<string, string>>({});
  readonly productErrors = signal<Record<string, string>>({});
  readonly homeError = signal('');
  readonly homeLoading = signal(false);
  readonly homeResolved = signal(false);
  readonly categoriesError = signal('');
  readonly storesError = signal('');
  readonly storesCount = signal<number | null>(null);
  readonly productsError = signal('');
  readonly collectionProducts = signal<Product[]>([]);
  readonly collectionCount = signal<number | null>(null);
  readonly productsHasMore = signal(false);
  private productRequest = 0;
  private productParams: Record<string, any> = {};
  private productPage = 1;
  loadMoreProducts(): void {
    if (this.productsHasMore() && !this.productsLoading())
      this.loadProducts(
        { ...this.productParams, page: this.productPage + 1 },
        true
      );
  }
  readonly exploreResults = signal<{
    products: Product[];
    stores: Store[];
    categories: Category[];
  }>({ products: [], stores: [], categories: [] });
  readonly exploreError = signal('');
  readonly exploreSummary = signal<{product_count?:number;store_count?:number;category_count?:number} | null>(null);
  readonly exploreHasMore = signal(false);
  private exploreRequest = 0;
  private exploreParams: Record<string, any> = {};
  private explorePage = 1;
  moreExplore(): void {
    if (this.exploreHasMore() && !this.productsLoading())
      this.loadExplore(
        { ...this.exploreParams, page: this.explorePage + 1 },
        true
      );
  }
  private homeRequest = 0;
  private homeParams: Record<string, any> = {};
  retryHome(): void {
    this.loadHome(this.homeParams);
  }

  readonly categories = this._categories.asReadonly();
  readonly allCategories = computed(() => {
    const result: Category[] = [];
    const visit = (category: Category) => {
      result.push(category);
      for (const child of category.raw?.children || []) {
        if (child.is_active !== false && child.show_in_customer_ui !== false)
          visit(this.mapCategory(child, result.length));
      }
    };
    for (const category of this._categories()) visit(category);
    return result;
  });
  readonly stores = this._stores.asReadonly();
  readonly products = this._products.asReadonly();
  readonly buyAgainProducts = this._buyAgainProducts.asReadonly();
  readonly recommendedProducts = this._recommendedProducts.asReadonly();
  readonly banners = this._banners.asReadonly();
  readonly coupons = this._coupons.asReadonly();
  readonly homeHero = this._homeHero.asReadonly();
  readonly homeSections = this._homeSections.asReadonly();
  readonly categoriesLoading = computed(
    () => this._categoryLoadingRequests() > 0
  );
  readonly storesLoading = computed(() => this._storeLoadingRequests() > 0);
  readonly storesHasMore = computed(() => this.nextStorePage() !== null);
  readonly productsLoading = computed(() => this._productLoadingRequests() > 0);
  readonly featuredStores = computed(() =>
    this._stores()
      .filter((store) => store.isExpress)
      .slice(0, 8)
  );
  readonly topProducts = computed(() => this._products().slice(0, 12));
  readonly topCoupons = computed(() => this._coupons().slice(0, 6));

  readonly bannersError = signal('');
  readonly couponsError = signal('');
  readonly couponsLoading = signal(false);
  private couponRequest = 0;
  private bannerRequest = 0;

  loadBanners(): void {
    const request = ++this.bannerRequest;
    this.bannersError.set('');
    this.api.getBanners().subscribe({
      next: response => { if(request === this.bannerRequest) this._banners.set(this.unwrap<any>(response).map(banner => this.mapBanner(banner))); },
      error: () => { if(request === this.bannerRequest) this.bannersError.set('Offers could not refresh. Try again.'); },
    });
  }

  loadCoupons(): void {
    if(this.couponsLoading()) return;
    const request = ++this.couponRequest;
    this.couponsLoading.set(true);
    this.couponsError.set('');
    this.api.getCoupons().pipe(finalize(() => { if(request === this.couponRequest) this.couponsLoading.set(false); })).subscribe({
      next: response => { if(request === this.couponRequest) this._coupons.set(this.unwrap<any>(response).map(coupon => this.mapCoupon(coupon))); },
      error: () => { if(request === this.couponRequest) this.couponsError.set('Available coupons could not load. Try again.'); },
    });
  }

  clearDeliverableCatalog(): void {
    ++this.catalogContext;
    ++this.couponRequest;
    ++this.bannerRequest;
    this.homeLoading.set(false);
    this.homeResolved.set(true);
    this.homeError.set('');
    this.categoriesError.set('');
    this.storesError.set('');
    this.productsError.set('');
    this.exploreError.set('');
    this.couponsLoading.set(false);
    this.couponsError.set('');
    this.bannersError.set('');
    this.productDetailRequests.clear();
    this.productDetailLoading.set({});
    this._stores.set([]);
    this.storeResults.set([]);
    this.homeStores.set([]);
    this.storesCount.set(null);
    this._products.set([]);
    this.collectionProducts.set([]);
    this.collectionCount.set(null);
    this.productsHasMore.set(false);
    this.exploreResults.set({products: [], stores: [], categories: []});
    this.exploreSummary.set(null);
    this.exploreHasMore.set(false);
    this._buyAgainProducts.set([]);
    this._recommendedProducts.set([]);
    this._storeProducts.set({});
    this._coupons.set([]);
    this._banners.set([]);
    this._homeHero.set(null);
    this._homeSections.set([]);
    this.nextStorePage.set(null);
    this.loadedStoreRequestKeys.clear();
    // Public storefront content is separate from deliverable shopping inventory.
    // Home can declare shopping unavailable after the current detail has loaded;
    // retain its readable products just as we retain its public store metadata.
    // A new detail response replaces this list with its location-scoped products.
    this.lastSearchQuery = '';
  }

  private currentCatalogContext(): () => boolean {
    const context = this.catalogContext;
    const session = this.auth.sessionVersion;
    return () => context === this.catalogContext && session === this.auth.sessionVersion;
  }

  loadHome(params: Record<string, any> = {}): void {
    const request = ++this.homeRequest;
    const current = this.currentCatalogContext();
    this.homeParams = params;
    this.homeError.set('');
    this.homeLoading.set(true);
    this.setCategoriesLoading(true);
    this.setStoresLoading(true);
    this.setProductsLoading(true);
    this.api
      .getHome(params)
      .pipe(
        finalize(() => {
          if (request === this.homeRequest && current()) {
            this.homeLoading.set(false);
            this.homeResolved.set(true);
          }
          this.setCategoriesLoading(false);
          this.setStoresLoading(false);
          this.setProductsLoading(false);
        })
      )
      .subscribe({
        next: (response) => {
          if (request !== this.homeRequest || !current()) return;
          const isServiceable =
            response?.serviceability?.is_serviceable !== false;
          const categories = this.unwrap<ApiCategory>(
            response?.categories || []
          )
            .filter(
              (category) =>
                category.show_in_customer_ui !== false &&
                category.is_active !== false
            )
            .map((category, index) => this.mapCategory(category, index));
          this._categories.set([
            { id: 'all', label: 'All', icon: 'grid_view', bg: '#f8fafc' },
            ...categories,
          ]);
          if (!isServiceable) {
            this.clearDeliverableCatalog();
            this._categories.set([
              { id: 'all', label: 'All', icon: 'grid_view', bg: '#f8fafc' },
              ...categories,
            ]);
            return;
          }
          const stores = this.unwrap<ApiVendor>(response?.nearby_stores || [])
            .map((vendor) => this.mapStore(vendor))
            .filter((store) => this.isServiceableStore(store));
          this.homeStores.set(stores);
          this.mergeStores(stores);
          const recommended = this.unwrap<ApiProduct>(
            response?.recommended_products || []
          )
            .map((product) => this.mapProduct(product))
            .filter((product) => this.isProductFromOpenStore(product));
          const flashDeals = this.unwrap<ApiProduct>(
            response?.flash_deals || []
          )
            .map((product) => this.mapProduct(product))
            .filter((product) => this.isProductFromOpenStore(product));
          const buyAgain = this.unwrap<ApiProduct>(this.auth.isLoggedIn() ? response?.buy_again || [] : [])
            .map((product) => this.mapProduct(product))
            .filter((product) => this.isProductFromOpenStore(product));
          this._buyAgainProducts.set(buyAgain);
          this.replaceProducts([...recommended, ...flashDeals, ...buyAgain]);
          this._recommendedProducts.set(recommended);
          this._coupons.set(
            this.unwrap<any>(response?.coupons || []).map((coupon) =>
              this.mapCoupon(coupon)
            )
          );
          this._banners.set(
            this.unwrap<any>(response?.banners || []).map((banner) =>
              this.mapBanner(banner)
            )
          );
          this._homeHero.set(this.mapHomeHero(response?.hero));
          this._homeSections.set(this.mapHomeSections(response?.sections));
        },
        error: () => {
          if (request === this.homeRequest && current())
            this.homeError.set(
              'Your neighbourhood could not refresh. Try again.'
            );
        },
      });
  }

  loadCategories(params: Record<string, any> = {}): void {
    const request = ++this.categoryRequest;
    const current = this.currentCatalogContext();
    this.categoriesError.set('');
    this.setCategoriesLoading(true);
    this.api
      .getCategories(params)
      .pipe(finalize(() => this.setCategoriesLoading(false)))
      .subscribe({
        next: (response) => {
          if (request !== this.categoryRequest || !current()) return;
          const categories = this.unwrap<ApiCategory>(response)
            .filter(
              (category) =>
                category.show_in_customer_ui !== false &&
                category.is_active !== false
            )
            .map((category, index) => this.mapCategory(category, index));
          const seen = new Set<string>();
          const uniqueCategories = categories.filter((category) => {
            const key = normalizeKey(
              category.raw?.slug || category.label || category.id
            );
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          this._categories.set([
            { id: 'all', label: 'All', icon: 'grid_view', bg: '#f8fafc' },
            ...uniqueCategories,
          ]);
        },
        error: () => {
          if (request === this.categoryRequest && current())
            this.categoriesError.set('Categories could not load. Try again.');
        },
      });
  }

  loadStores(
    params: Record<string, any> = {},
    options: {
      append?: boolean;
      page?: number;
      pageSize?: number;
      allowFallback?: boolean;
    } = {}
  ): void {
    const page = Number(options.page || params['page'] || 1);
    const pageSize = Number(options.pageSize || params['page_size'] || 12);
    const requestId = ++this.storeRequestSequence;
    const current = this.currentCatalogContext();
    this.storesError.set('');
    const { primary, fallback } = buildStoreDiscoveryQueryPlan(
      params,
      {
        lat: params['lat'],
        lng: params['lng'],
        state: params['state'],
        city: params['city'],
        postal_code: params['postal_code'],
      },
      { page, pageSize, fallbackToState: options.allowFallback === true }
    );
    this.lastStoreFilters = { ...params, page_size: pageSize };
    this.setStoresLoading(true);
    this.api.getVendors(primary).subscribe({
      next: (response) => {
        if (requestId !== this.storeRequestSequence || !current()) {
          this.setStoresLoading(false);
          return;
        }
        const stores = this.unwrap<ApiVendor>(response).map((vendor) =>
          this.mapStore(vendor)
        );
        if (
          !stores.length &&
          fallback &&
          this.requestKey(primary) !== this.requestKey(fallback)
        ) {
          this.api
            .getVendors(fallback)
            .pipe(finalize(() => this.setStoresLoading(false)))
            .subscribe({
              next: (fallbackResponse) => {
                if (requestId !== this.storeRequestSequence || !current()) return;
                this.applyStoreResponse(fallbackResponse, !!options.append);
              },
              error: () => {
                if (requestId === this.storeRequestSequence && current())
                  this.storesError.set(
                    'Stores could not load. Please try again.'
                  );
              },
            });
          return;
        }
        this.applyStoreResponse(response, !!options.append);
        this.setStoresLoading(false);
      },
      error: () => {
        if (requestId !== this.storeRequestSequence || !current()) {
          this.setStoresLoading(false);
          return;
        }
        this.storesError.set('Stores could not load. Please try again.');
        this.setStoresLoading(false);
      },
    });
  }

  loadMoreStores(): void {
    const page = this.nextStorePage();
    if (!page || this.storesLoading()) return;
    this.loadStores(this.lastStoreFilters, {
      append: true,
      page,
      pageSize: Number(this.lastStoreFilters['page_size'] || 12),
    });
  }

  loadBestDealRecommendations(storeId?: string): void {
    const request = ++this.recommendationRequest;
    const current = this.currentCatalogContext();
    const id = storeId || this._stores()[0]?.id;
    if (!id) {
      this._recommendedProducts.set([]);
      return;
    }
    this.api.vendorRecommendations(id).subscribe({
      next: (response) => {
        if (request !== this.recommendationRequest || !current()) return;
        const products = normalizeRecommendationResponse(
          response,
          (product, context) =>
            this.mapProduct(
              product as ApiProduct,
              { id: context?.storeId, store_name: context?.storeName } as any
            )
        ).map((item) => item.product);
        this._recommendedProducts.set(products);
        this.mergeProducts(products);
      },
      error: () => {
        if (request === this.recommendationRequest && current()) this._recommendedProducts.set([]);
      },
    });
  }

  loadProducts(params: Record<string, any> = {}, append = false): void {
    const request = ++this.productRequest;
    const current = this.currentCatalogContext();
    this.productParams = params;
    this.productsError.set('');
    this.setProductsLoading(true);
    this.api
      .getProducts(params)
      .pipe(finalize(() => this.setProductsLoading(false)))
      .subscribe({
        next: (response) => {
          if (request !== this.productRequest || !current()) return;
          const products = this.unwrap<ApiProduct>(response).map((product) =>
            this.mapProduct(product)
          );
          this.collectionProducts.set(
            append
              ? [
                  ...this.collectionProducts(),
                  ...products.filter(
                    (p) =>
                      !this.collectionProducts().some((old) => old.id === p.id)
                  ),
                ]
              : products
          );
          this.mergeProducts(products);
          this.productPage = Number(params['page'] || 1);
          this.productsHasMore.set(!!response?.next);
          this.collectionCount.set(
            Number.isFinite(Number(response?.count))
              ? Number(response.count)
              : null
          );
        },
        error: () => {
          if (request === this.productRequest && current())
            this.productsError.set(
              'Products could not load. Please try again.'
            );
        },
      });
  }

  loadExplore(params: Record<string, any> = {}, append = false): void {
    const request = ++this.exploreRequest;
    const current = this.currentCatalogContext();
    this.exploreParams = params;
    this.exploreError.set('');
    this.setProductsLoading(true);
    this.api
      .explore(params)
      .pipe(finalize(() => this.setProductsLoading(false)))
      .subscribe({
        next: (response) => {
          if (request !== this.exploreRequest || !current()) return;
          this.exploreSummary.set(response?.summary || null);
          const products = this.unwrap<ApiProduct>(
            response?.products || []
          ).map((p) => this.mapProduct(p));
          const stores = this.unwrap<ApiVendor>(response?.stores || []).map(
            (v) => this.mapStore(v)
          );
          const categories = this.unwrap<ApiCategory>(
            response?.categories || []
          ).map((c, i) => this.mapCategory(c, i));
          const old = this.exploreResults();
          this.exploreResults.set({
            products: append
              ? [
                  ...old.products,
                  ...products.filter(
                    (p) => !old.products.some((o) => o.id === p.id)
                  ),
                ]
              : products,
            stores: append
              ? [
                  ...old.stores,
                  ...stores.filter(
                    (p) => !old.stores.some((o) => o.id === p.id)
                  ),
                ]
              : stores,
            categories: append
              ? [
                  ...old.categories,
                  ...categories.filter(
                    (p) => !old.categories.some((o) => o.id === p.id)
                  ),
                ]
              : categories,
          });
          this.mergeProducts(products);
          this.explorePage = Number(params['page'] || 1);
          this.exploreHasMore.set(!!response?.next_page);
        },
        error: () => {
          if (request === this.exploreRequest && current())
            this.exploreError.set(
              'Search could not complete. Your query is still here.'
            );
        },
      });
  }

  private readonly storeDetails = signal<Record<string, Store>>({});
  private readonly storeDetailProducts = signal<Record<string, Product[]>>({});
  private readonly latestStoreRequestKeys = new Map<string, string>();

  productsForStoreDetail(id: string): Product[] {
    return this.storeDetailProducts()[id] || this.productsByStore(id);
  }

  getStoreDetail(id: string): Store {
    return this.storeDetails()[id] || this.getStore(id);
  }

  loadStoreProducts(storeId: string, params: Record<string, any> = {}): void {
    if (!storeId) return;
    const requestKey = this.requestKey(params);
    const current = this.currentCatalogContext();
    if (this.loadedStoreRequestKeys.get(storeId) === requestKey) return;
    const detailRequest = `${++this.storeDetailSequence}:${requestKey}`;
    this.storeErrors.update((errors) => ({ ...errors, [storeId]: '' }));
    this.loadedStoreRequestKeys.set(storeId, requestKey);
    this.latestStoreRequestKeys.set(storeId, detailRequest);
    this.setStoreProductsLoading(storeId, detailRequest);
    this.api.getVendor(storeId, params).subscribe({
      next: (vendor) => {
        if (this.latestStoreRequestKeys.get(storeId) !== detailRequest) return;
        const products = (vendor.products || []).map((product: ApiProduct) =>
          this.mapProduct(product, vendor)
        );
        const detail = this.mapStore(vendor);
        this.storeDetails.update(current => ({...current, [storeId]: detail}));
        this.storeDetailProducts.update(current => ({...current, [storeId]: products}));
        // Public store details remain readable when Home declares the area unavailable.
        // Only the current shopping context may repopulate deliverable inventory.
        if (current() && this.loadedStoreRequestKeys.get(storeId) === requestKey) {
          this.mergeStores([detail]);
          this.setStoreProducts(storeId, products);
          this.mergeProducts(products);
        }
        this.clearStoreProductsLoading(storeId, detailRequest);
      },
      error: (error) => {
        if (this.latestStoreRequestKeys.get(storeId) !== detailRequest) return;
        const status = error?.status;
        this.storeErrors.update((errors) => ({
          ...errors,
          [storeId]:
            status === 404
              ? 'This store could not be found.'
              : status === 403
              ? 'This store is not accessible.'
              : 'This store could not load. Try again.',
        }));
        if (this.loadedStoreRequestKeys.get(storeId) === requestKey)
          this.loadedStoreRequestKeys.delete(storeId);
        this.clearStoreProductsLoading(storeId, detailRequest);
      },
    });
  }

  isStoreProductsLoading(storeId: string): boolean {
    return !!storeId && !!this._storeProductLoadingRequests()[storeId];
  }

  getStore(id: string | null): Store {
    const key = String(id || '');
    const store = key
      ? this._stores().find((item) => item.id === key)
      : this._stores()[0];
    return store || this.emptyStore(key);
  }

  getProduct(id: string | null): Product {
    const key = String(id || '');
    const product = this._products().find(
      (item) => item.id === key || item.apiId === key
    );
    return product || this.emptyProduct(key);
  }

  ensureProductLoaded(
    id: string | null,
    params: Record<string, any> = {},
    force = false
  ): void {
    const key = String(id || '');
    const session = this.auth.sessionVersion;
    const context = JSON.stringify([session, params]);
    if (
      !key ||
      this.productDetailRequests.get(key)?.context === context ||
      (!force &&
        this._products().some((item) => item.id === key || item.apiId === key))
    )
      return;
    this.productErrors.update((errors) => ({ ...errors, [key]: '' }));
    const sequence = ++this.productDetailSequence;
    this.productDetailRequests.set(key, {sequence,context});
    this.productDetailLoading.update(loading => ({...loading,[key]:true}));
    const current = () => this.productDetailRequests.get(key)?.sequence === sequence && session === this.auth.sessionVersion;
    this.setProductsLoading(true);
    this.api
      .getProduct(key, params)
      .pipe(finalize(() => {
        this.setProductsLoading(false);
        if(current()){
          this.productDetailRequests.delete(key);
          this.productDetailLoading.update(loading => ({...loading,[key]:false}));
        }
      }))
      .subscribe({
        next: (response) => {
          if(!current())return;
          this.mergeProducts([this.mapProduct(response)]);
        },
        error: (error) => {
          if(!current())return;
          this.productErrors.update((errors) => ({
            ...errors,
            [key]:
              error?.status === 404
                ? 'Product not found.'
                : error?.status === 403
                ? 'You cannot access this product.'
                : 'Product could not load. Please try again.',
          }));
        },
      });
  }

  ensureStoreProductsLoaded(
    storeId: string | null,
    params: Record<string, any> = {}
  ): void {
    const key = String(storeId || '');
    if (!key) return;
    this.loadStoreProducts(key, params);
  }

  productsByStore(storeId: string): Product[] {
    return (
      this._storeProducts()[storeId] ||
      this._products().filter((product) => product.storeId === storeId)
    );
  }

  productsByCategory(category: string): Product[] {
    const keys = this.categoryKeys(category);
    const products = this._products().filter((product) =>
      this.isProductFromOpenStore(product)
    );
    if (!keys.size || keys.has('all')) return products;
    return products.filter((product) =>
      this.productCategoryKeys(product).some((key) => keys.has(key))
    );
  }

  search(query: string): {
    stores: Store[];
    products: Product[];
    categories: Category[];
  } {
    const terms = parseMultiSearchQuery(query).map((term) =>
      term.value.toLowerCase()
    );
    if (!terms.length) return { stores: [], products: [], categories: [] };
    const matchesAny = (value: string | null | undefined) =>
      terms.some((term) =>
        String(value || '')
          .toLowerCase()
          .includes(term)
      );
    return {
      stores: terms
        .flatMap((q) =>
          searchVendors(
            this._stores().map((store) => store.raw || store),
            q
          ).map((store) => this.mapStore(store as ApiVendor))
        )
        .filter((store) => this.isServiceableStore(store))
        .filter(
          (store, index, all) =>
            all.findIndex((item) => item.id === store.id) === index
        )
        .slice(0, 8),
      products: terms
        .flatMap((q) =>
          searchProducts(
            this._products().map((product) => product.raw || product) as any[],
            q
          ).map((product) => this.mapProduct(product as ApiProduct))
        )
        .filter((product) => this.isProductFromOpenStore(product))
        .filter(
          (product, index, all) =>
            all.findIndex((item) => item.id === product.id) === index
        )
        .slice(0, 12),
      categories: this._categories()
        .filter((category) => category.id !== 'all')
        .filter((category) => matchesAny(category.label))
        .slice(0, 6),
    };
  }

  refreshSearch(query: string, params: Record<string, any> = {}): void {
    const q = parseMultiSearchQuery(query)
      .map((term) => term.value)
      .join(',');
    if (!q) {
      ++this.searchRequest;
      this.lastSearchQuery = '';
      return;
    }
    const key = this.requestKey({...params, search: q});
    if (key === this.lastSearchQuery) return;
    this.lastSearchQuery = key;
    const request = ++this.searchRequest;
    const current = this.currentCatalogContext();
    this.setProductsLoading(true);
    this.api
      .getProducts({ ...params, search: q })
      .pipe(finalize(() => this.setProductsLoading(false)))
      .subscribe({
        next: (response) => {
          if (request !== this.searchRequest || !current()) return;
          this.mergeProducts(
            this.unwrap<ApiProduct>(response).map((product) =>
              this.mapProduct(product)
            )
          );
        },
        error: () => {},
      });
    this.setStoresLoading(true);
    this.api
      .getVendors({ ...params, search: q })
      .pipe(finalize(() => this.setStoresLoading(false)))
      .subscribe({
        next: (response) => {
          if (request !== this.searchRequest || !current()) return;
          const vendors = this.unwrap<ApiVendor>(response);
          const stores = vendors
            .map((vendor) => this.mapStore(vendor))
            .filter((store) => this.isServiceableStore(store));
          const serviceableStoreIds = new Set(stores.map((store) => store.id));
          this.mergeStores(stores);
          this.mergeProducts(
            vendors
              .filter((vendor) => serviceableStoreIds.has(String(vendor.id)))
              .flatMap((vendor) =>
                (vendor.products || []).map((product) =>
                  this.mapProduct(product, vendor)
                )
              )
          );
        },
        error: () => {},
      });
  }

  mapProduct(product: ApiProduct, vendor?: ApiVendor): Product {
    return normalizeSharedProduct(
      product as any,
      vendor as any,
      FALLBACK_PRODUCT_IMAGE
    ) as Product;
  }

  private mapCategory(category: ApiCategory, index: number): Category {
    return normalizeSharedCategory(category as any, index) as Category;
  }

  private mapBanner(banner: any): PlatformBanner {
    return normalizeSharedBanner(banner) as PlatformBanner;
  }

  private mapCoupon(coupon: any): CustomerCoupon {
    return normalizeSharedCoupon(coupon) as CustomerCoupon;
  }

  private mapHomeHero(hero: unknown): CustomerHomeHero | null {
    if (!hero || typeof hero !== 'object') return null;
    const heroRecord = hero as Record<string, unknown>;
    return {
      title: String(heroRecord['title'] || ''),
      subtitle: String(heroRecord['subtitle'] || ''),
      badge: String(heroRecord['badge'] || ''),
      cta_label: String(
        heroRecord['cta_label'] || heroRecord['ctaLabel'] || 'Shop now'
      ),
      cta_url: String(
        heroRecord['cta_url'] || heroRecord['ctaUrl'] || '/explore'
      ),
      image: String(heroRecord['image'] || ''),
      store: heroRecord['store'] || null,
      coupon: heroRecord['coupon'] || null,
    };
  }

  private mapHomeSections(sections: unknown): CustomerHomeSection[] {
    if (!Array.isArray(sections)) return [];
    return sections.map((section) => {
      const sectionRecord =
        section && typeof section === 'object'
          ? (section as Record<string, unknown>)
          : {};
      const items = Array.isArray(sectionRecord['items'])
        ? sectionRecord['items']
        : [];
      return {
        key: String(sectionRecord['key'] || ''),
        title: String(sectionRecord['title'] || ''),
        layout: String(sectionRecord['layout'] || ''),
        items,
        count: Number(sectionRecord['count'] || items.length || 0),
      };
    });
  }

  private mapStore(vendor: ApiVendor): Store {
    return normalizeSharedVendor(vendor as any, FALLBACK_STORE_IMAGE) as Store;
  }

  private mergeProducts(incoming: Product[]): void {
    const merged = new Map<string, Product>();
    for (const product of this._products()) merged.set(product.id, product);
    for (const product of incoming) {
      const previous = merged.get(product.id);
      merged.set(product.id, { ...product, raw: product.raw ? { ...previous?.raw, ...product.raw } : previous?.raw });
    }
    this._products.set([...merged.values()]);
  }

  private replaceProducts(incoming: Product[]): void {
    const previous = new Map(this._products().map(product => [product.id, product]));
    const merged = new Map<string, Product>();
    for (const product of incoming) merged.set(product.id, { ...product, raw: product.raw ? { ...previous.get(product.id)?.raw, ...product.raw } : previous.get(product.id)?.raw });
    this._products.set([...merged.values()]);
  }

  private mergeStores(incoming: Store[]): void {
    const merged = new Map<string, Store>();
    for (const store of this._stores()) merged.set(store.id, store);
    for (const store of incoming) merged.set(store.id, store);
    this._stores.set([...merged.values()]);
  }

  private applyStoreResponse(response: any, append: boolean): void {
    const stores = this.unwrap<ApiVendor>(response)
      .map((vendor) => this.mapStore(vendor))
      .filter((store) => this.isServiceableStore(store));
    this.mergeStores(stores);
    this.storeResults.update(current => append
      ? [...current, ...stores.filter(store => !current.some(existing => existing.id === store.id))]
      : stores);
    const serviceableStoreIds = new Set(stores.map((store) => store.id));
    const storeProducts = this.unwrap<ApiVendor>(response)
      .filter((vendor) => serviceableStoreIds.has(String(vendor.id)))
      .flatMap((vendor) =>
        (vendor.products || []).map((product) =>
          this.mapProduct(product, vendor)
        )
      );
    if (storeProducts.length) this.mergeProducts(storeProducts);
    this.storesCount.set(Number.isFinite(Number(response?.count)) ? Number(response.count) : null);
    this.nextStorePage.set(this.readNextPage(response));
    this.loadBestDealRecommendations(this.storeResults()[0]?.id);
  }

  private isServiceableStore(store: Store): boolean {
    return (
      (store.raw as any)?.is_serviceable !== false &&
      this.isStoreOpenForShopping(store)
    );
  }

  private isStoreOpenForShopping(store: Store | null | undefined): boolean {
    const raw = (store?.raw || {}) as Record<string, any>;
    return (
      (raw['is_open_now'] ?? raw['is_open']) !== false &&
      raw['is_accepting_orders'] !== false
    );
  }

  private isProductFromOpenStore(product: Product): boolean {
    const raw = (product.raw || {}) as Record<string, any>;
    const vendor = raw['vendor'] || raw['store'];
    if (vendor) {
      return (
        (vendor['is_open_now'] ?? vendor['is_open']) !== false &&
        vendor['is_accepting_orders'] !== false
      );
    }
    const loadedStore = product.storeId
      ? this._stores().find((store) => store.id === product.storeId)
      : null;
    if (product.storeId && !loadedStore) return false;
    return this.isStoreOpenForShopping(loadedStore);
  }

  private readNextPage(response: any): number | null {
    const next = response?.next;
    if (!next || typeof next !== 'string') return null;
    try {
      const url = new URL(next, 'http://nextou.local');
      const page = Number(url.searchParams.get('page'));
      return Number.isFinite(page) && page > 0 ? page : null;
    } catch {
      const match = next.match(/[?&]page=(\d+)/);
      return match ? Number(match[1]) : null;
    }
  }

  private setStoreProducts(storeId: string, products: Product[]): void {
    this._storeProducts.update((current) => ({
      ...current,
      [storeId]: products,
    }));
  }

  private unwrap<T>(response: any): T[] {
    return listFromResponse<T>(response);
  }

  private normalize(value: string | null | undefined): string {
    return normalizeKey(value);
  }

  private categoryKeys(value: string | null | undefined): Set<string> {
    const key = this.normalize(value);
    const keys = new Set<string>();
    if (!key) return keys;
    keys.add(key);

    for (const category of this._categories()) {
      const raw = (category.raw || {}) as Record<string, unknown>;
      const candidates = [
        category.id,
        category.label,
        raw['id'],
        raw['slug'],
        raw['name'],
        raw['title'],
      ];
      if (
        !candidates.some((candidate) => this.normalizeValue(candidate) === key)
      ) {
        continue;
      }
      for (const candidate of candidates) {
        const normalized = this.normalizeValue(candidate);
        if (normalized) keys.add(normalized);
      }
    }

    return keys;
  }

  private productCategoryKeys(product: Product): string[] {
    const raw = (product.raw || {}) as Record<string, any>;
    const category = raw['category'];
    const candidates = [
      product.category,
      raw['category_name'],
      raw['categoryName'],
      raw['category_slug'],
      raw['categorySlug'],
      raw['category_id'],
      raw['categoryId'],
      typeof category === 'string' ? category : undefined,
      category?.id,
      category?.slug,
      category?.name,
      category?.title,
    ];
    return [
      ...new Set(
        candidates
          .map((candidate) => this.normalizeValue(candidate))
          .filter(Boolean)
      ),
    ];
  }

  private normalizeValue(value: unknown): string {
    return this.normalize(String(value ?? ''));
  }

  private requestKey(params: Record<string, any>): string {
    return JSON.stringify(
      Object.keys(params)
        .filter(
          (key) =>
            params[key] !== undefined &&
            params[key] !== null &&
            params[key] !== ''
        )
        .sort()
        .reduce<Record<string, any>>((result, key) => {
          result[key] = params[key];
          return result;
        }, {})
    );
  }

  private setStoreProductsLoading(storeId: string, requestKey: string): void {
    this._storeProductLoadingRequests.update((current) => ({
      ...current,
      [storeId]: requestKey,
    }));
  }

  private setCategoriesLoading(loading: boolean): void {
    this._categoryLoadingRequests.update((count) =>
      Math.max(0, count + (loading ? 1 : -1))
    );
  }

  private setStoresLoading(loading: boolean): void {
    this._storeLoadingRequests.update((count) =>
      Math.max(0, count + (loading ? 1 : -1))
    );
  }

  private setProductsLoading(loading: boolean): void {
    this._productLoadingRequests.update((count) =>
      Math.max(0, count + (loading ? 1 : -1))
    );
  }

  private clearStoreProductsLoading(storeId: string, requestKey: string): void {
    this._storeProductLoadingRequests.update((current) => {
      if (current[storeId] !== requestKey) return current;
      const next = { ...current };
      delete next[storeId];
      return next;
    });
  }

  private emptyProduct(id: string): Product {
    return {
      id: id || 'loading',
      name: 'Loading product',
      unit: '',
      price: 0,
      mrp: 0,
      discount: '',
      image: FALLBACK_PRODUCT_IMAGE,
      category: 'Products',
      rating: 0,
      storeId: '',
      highlights: [],
    };
  }

  private emptyStore(id: string): Store {
    return {
      id: id || 'loading',
      name: 'Loading store',
      category: 'Store',
      rating: 0,
      ratings: 'New',
      eta: '',
      distance: '',
      offer: '',
      delivery: '',
      image: FALLBACK_STORE_IMAGE,
      hero: FALLBACK_STORE_IMAGE,
      tags: [],
    };
  }
}
