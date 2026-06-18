import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  selectNearbySavedAddress,
  buildCustomerLocationQuery,
  type GeoCoordinates,
  type AddressWithCoordinates,
} from '@nexconnect/customer-location';
import { mapCustomerError } from '@nexconnect/customer-errors';
import {
  checkoutPaymentMethodForBackend,
  normalizeCheckoutPaymentMethod,
} from '@nexconnect/customer-checkout';
import {
  cartItemCount,
  cartMrpTotal,
  cartSavings,
  cartSubtotal,
  checkoutTotal,
  createAddressPayload,
  createCheckoutPayload,
  deliveryFeeFromPreview,
  deliveryFeeLabel as formatDeliveryFeeLabel,
  getDeliveryPromotion,
  handlingFeeForItems,
  normalizeAddress as normalizeSharedAddress,
  normalizeOrder as normalizeSharedOrder,
  readApiError,
  shouldOpenCartAfterAdd,
} from '@nexconnect/customer-core';
import {
  compact,
  isCustomerAddressComplete,
  validateCode,
} from '@nexconnect/customer-validation';
import { map, Observable, throwError } from 'rxjs';
import {
  type Address as ApiAddress,
  type Cart as ApiCart,
  type CartItem as ApiCartItem,
} from '@shared/lib/models';
import { ApiService } from '@shared/lib/services/api.service';
import { CurrencyService } from '@shared/lib/services/currency.service';
import { LocationService } from '@shared/lib/services/location.service';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { ToastService } from '@shared/lib/services/toast.service';
import {
  ActiveOrderSummary,
  Address,
  CartItem,
  CustomerServiceability,
  Order,
  PaymentMethod,
  Product,
} from '../models';
import { CustomerAccountApiService } from './customer-account-api.service';
import { CustomerCartApiService } from './customer-cart-api.service';
import { CustomerCatalogApiService } from './customer-catalog-api.service';
import { CustomerApiClientService } from './customer-api-client.service';
import { CatalogService } from './catalog.service';
import { UiService } from './ui.service';
import { BrowserPaymentAdapter } from './adapters/browser-payment.adapter';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
export interface AppToast {
  message: string;
  tone: ToastTone;
}

interface GuestCartPayload {
  version: 1;
  updatedAt: string;
  store?: {
    id: string;
    name: string;
  };
  items: CartItem[];
}

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly accountApi = inject(CustomerAccountApiService);
  private readonly api = inject(ApiService);
  private readonly cartApi = inject(CustomerCartApiService);
  private readonly catalogApi = inject(CustomerCatalogApiService);
  private readonly customerApi = inject(CustomerApiClientService);
  private readonly catalog = inject(CatalogService);
  private readonly auth = inject(SharedAuthService);
  private readonly currency = inject(CurrencyService);
  private readonly locationService = inject(LocationService);
  private readonly ui = inject(UiService);
  private readonly paymentAdapter = inject(BrowserPaymentAdapter);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly guestCartStorageKey = 'nextou.customer.guestCart.v1';
  private authenticatedBootstrapComplete = false;
  private toastTimer: number | null = null;

  readonly location = signal('Select location');
  readonly cart = signal<CartItem[]>([]);
  readonly addresses = signal<Address[]>([]);
  readonly paymentMethods = signal<PaymentMethod[]>([]);
  readonly activeAddress = signal<Address | null>(null);
  readonly selectedPaymentMethod = signal('');
  readonly issueOptions = signal<
    Array<{ value: string; label: string; description?: string }>
  >([]);
  readonly coupon = signal('');
  readonly couponDiscount = signal(0);
  readonly toast = signal<AppToast | null>(null);
  readonly miniCartOpen = signal(false);
  readonly lastAddedProductId = signal('');
  readonly checkoutSubmitting = signal(false);
  readonly lastCheckoutError = signal('');
  readonly deliveryFeePreview = signal<any>(null);
  readonly checkoutPriceBreakup = signal<Record<string, any> | null>(null);
  readonly requiresFarDeliveryConfirmation = signal(false);
  private readonly deliveryFeePreviewReadyAddressId = signal('');
  readonly cartLoaded = signal(false);
  readonly serviceability = signal<CustomerServiceability | null>(null);
  readonly serviceabilityLoading = signal(false);
  readonly activeOrder = signal<ActiveOrderSummary | null>(null);

  readonly itemCount = computed(() => cartItemCount(this.cart()));
  readonly subtotal = computed(() => cartSubtotal(this.cart()));
  readonly mrpTotal = computed(() => cartMrpTotal(this.cart()));
  readonly discount = computed(() =>
    cartSavings(this.cart(), this.couponDiscount())
  );
  readonly deliveryFee = computed(() =>
    deliveryFeeFromPreview(this.deliveryFeePreview(), !!this.cart().length)
  );
  readonly deliveryPromotion = computed(() =>
    getDeliveryPromotion({
      subtotal: this.subtotal(),
      deliveryFee: this.deliveryFee(),
      hasItems: !!this.cart().length,
    })
  );
  readonly freeDeliveryUnlocked = computed(
    () => this.deliveryPromotion().unlocked
  );
  readonly freeDeliveryRemaining = computed(
    () => this.deliveryPromotion().remaining
  );
  readonly freeDeliveryProgress = computed(
    () => this.deliveryPromotion().progress
  );
  readonly deliveryFeeLabel = computed(() =>
    this.deliveryFee() > 0
      ? this.currency.format(this.deliveryFee())
      : formatDeliveryFeeLabel(this.deliveryFee())
  );
  readonly platformFee = computed(() =>
    this.priceBreakupAmount('platform_fee')
  );
  readonly handlingFee = computed(() =>
    this.checkoutPriceBreakup()
      ? this.priceBreakupAmount('packaging_fee')
      : handlingFeeForItems(this.cart())
  );
  readonly smallCartFee = computed(() =>
    this.priceBreakupAmount('small_cart_fee')
  );
  readonly taxAmount = computed(() => this.priceBreakupAmount('tax_amount'));
  readonly surgeFee = computed(() => this.priceBreakupAmount('surge_fee'));
  readonly total = computed(
    () =>
      this.priceBreakupAmount('final_payable') ||
      checkoutTotal({
        subtotal: this.subtotal(),
        deliveryFee: this.deliveryFee(),
        handlingFee: this.handlingFee(),
        couponDiscount: this.couponDiscount(),
      })
  );
  constructor() {
    const loc = this.locationService.location();
    if (loc?.name) {
      this.location.set(this.formatLocation(loc.name, loc.city));
      this.refreshCatalogForLocation(loc);
    }
    this.locationService
      .initializeLocation()
      .then((location) => {
        if (location?.name) {
          this.location.set(this.formatLocation(location.name, location.city));
          this.refreshCatalogForLocation(location);
        }
      })
      .catch(() => {});
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      if (loggedIn) {
        this.bootstrapAuthenticatedState();
      } else {
        this.authenticatedBootstrapComplete = false;
        this.loadGuestCart();
        this.addresses.set([]);
        this.paymentMethods.set([]);
        this.activeAddress.set(null);
        this.selectedPaymentMethod.set('');
        this.issueOptions.set([]);
        this.activeOrder.set(null);
      }
    });
    effect(() => {
      this.cart();
      this.activeAddress();
      this.coupon();
      this.selectedPaymentMethod();
      this.requiresFarDeliveryConfirmation();
      this.refreshCheckoutPreview();
    });
  }

  private bootstrapAuthenticatedState(): void {
    if (this.authenticatedBootstrapComplete) return;
    this.authenticatedBootstrapComplete = true;
    this.api.getProfile().subscribe({
      next: (user) => {
        this.auth.updateUserData(user);
        this.mergeGuestCartIntoBackend(() => this.loadCart());
        this.loadAddresses();
        this.loadPaymentMethods();
        this.loadIssueOptions();
        this.loadActiveOrder();
      },
      error: () => {
        this.auth.clearInvalidSession();
        this.cart.set([]);
        this.cartLoaded.set(true);
        this.addresses.set([]);
        this.paymentMethods.set([]);
        this.activeAddress.set(null);
        this.selectedPaymentMethod.set('');
        this.issueOptions.set([]);
        this.activeOrder.set(null);
      },
    });
  }

  private refreshCatalogForLocation(location: {
    lat?: number;
    lng?: number;
    state?: string;
    city?: string;
    postalCode?: string;
  }): void {
    const params = {
      lat: Number.isFinite(Number(location.lat))
        ? Number(location.lat)
        : undefined,
      lng: Number.isFinite(Number(location.lng))
        ? Number(location.lng)
        : undefined,
      state: location.state || '',
      city: location.city || '',
      postal_code: location.postalCode || '',
    };
    this.catalog.loadHome(params);
    this.catalog.loadCategories(params);
    this.catalog.loadStores(params);
    this.checkServiceability(params);
  }

  addToCart(product: Product, quantity = 1): boolean {
    if (!this.isStoreOpenForProduct(product)) {
      this.showToast(this.storeClosedMessage(product));
      return false;
    }
    if (!this.auth.isLoggedIn()) {
      this.addToGuestCart(product, quantity);
      return true;
    }
    const productId = product.apiId || product.id;
    this.cartApi.addToCart(productId, quantity).subscribe({
      next: () => {
        this.lastAddedProductId.set(product.id);
        this.loadCart();
        if (this.shouldAutoOpenMiniCart()) this.openMiniCart();
        this.showToast(`${product.name} added to cart`);
      },
      error: (error) => this.handleAddToCartError(error, product, quantity),
    });
    return true;
  }

  private handleAddToCartError(
    error: any,
    product: Product,
    quantity: number
  ): void {
    const body = error?.body || error?.error || {};
    const message = this.explainApiError(error, 'Could not add item to cart');
    const conflictCode = body?.code || body?.error_code;
    if (
      conflictCode === 'cart_store_conflict' ||
      message.toLowerCase().includes('cart has items from')
    ) {
      const existingStore =
        body?.existing_store_name ||
        body?.existingStoreName ||
        'the current store';
      const incomingStore =
        body?.incoming_store_name || product.storeName || 'this store';
      const confirmMessage =
        body?.message ||
        `Your basket has items from ${existingStore}. To order from ${incomingStore}, replace basket?`;
      this.ui
        .confirm({
          title: 'Replace cart?',
          message: confirmMessage,
          confirmText: 'Clear and add',
          cancelText: 'Keep basket',
          tone: 'warning',
        })
        .then((confirmed) => {
          if (!confirmed) return;
          const productId = product.apiId || product.id;
          this.cartApi.replaceCart(productId, quantity).subscribe({
            next: () => {
              this.lastAddedProductId.set(product.id);
              this.loadCart();
              if (this.shouldAutoOpenMiniCart()) this.openMiniCart();
              this.showToast(`${product.name} added to cart`);
            },
            error: (replaceError) =>
              this.showToast(
                this.explainApiError(replaceError, 'Could not replace cart')
              ),
          });
        });
      return;
    }
    this.showToast(message);
  }

  updateQuantity(productId: string, delta: number): void {
    const item = this.cart().find(
      (entry) => entry.id === productId || entry.apiId === productId
    );
    if (!item) return;
    const nextQuantity = item.quantity + delta;
    if (!this.auth.isLoggedIn() || !item.cartItemId) {
      this.updateGuestCartItem(item, nextQuantity);
      return;
    }
    const request =
      nextQuantity <= 0
        ? this.cartApi.removeCartItem(item.cartItemId)
        : this.cartApi.updateCartItem(item.cartItemId, nextQuantity);
    request.subscribe({
      next: () => this.loadCart(),
      error: (error) =>
        this.showToast(this.explainApiError(error, 'Could not update cart')),
    });
  }

  removeItem(productId: string): void {
    const item = this.cart().find(
      (entry) => entry.id === productId || entry.apiId === productId
    );
    if (!item) return;
    if (!this.auth.isLoggedIn() || !item.cartItemId) {
      this.updateGuestCartItem(item, 0);
      this.showToast('Item removed');
      return;
    }
    this.cartApi.removeCartItem(item.cartItemId).subscribe({
      next: () => {
        this.loadCart();
        this.showToast('Item removed');
      },
      error: (error) =>
        this.showToast(this.explainApiError(error, 'Could not remove item')),
    });
  }

  clearCart(): void {
    if (!this.auth.isLoggedIn()) {
      this.commitGuestCart([]);
      return;
    }
    this.cartApi.clearCart().subscribe({
      next: () => {
        this.cart.set([]);
        this.cartApi.refreshCartCount();
      },
      error: (error) =>
        this.showToast(this.explainApiError(error, 'Could not clear cart')),
    });
  }

  applyCoupon(code: string): void {
    const validationError = validateCode(code, 'Coupon code');
    if (validationError) {
      this.showToast(validationError);
      return;
    }
    const normalized = compact(code).toUpperCase();
    if (!this.auth.isLoggedIn()) {
      this.ui.openLogin();
      this.showToast('Sign in to apply coupons');
      return;
    }
    this.coupon.set(normalized);
    this.couponDiscount.set(0);
    this.cartApi
      .validateCoupon(
        normalized,
        this.subtotal(),
        this.activeAddress()?.id || null
      )
      .subscribe({
        next: (coupon) => {
          this.coupon.set(coupon.code || normalized);
          this.couponDiscount.set(Number(coupon.discount || 0));
          this.refreshCheckoutPreview();
          this.showToast(`${this.coupon()} applied`);
        },
        error: (error) => {
          this.coupon.set('');
          this.couponDiscount.set(0);
          this.refreshCheckoutPreview();
          this.showToast(
            this.explainApiError(error, 'Coupon is not valid for this order')
          );
        },
      });
  }

  updateLocation(value: string): void {
    this.location.set(value);
  }

  selectMapLocation(location: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  }): void {
    const name = location.address || location.city || 'Selected location';
    this.locationService.setManualLocation({
      lat: Number(location.lat),
      lng: Number(location.lng),
      name,
      city: location.city || '',
      state: location.state || '',
      postalCode: location.postal_code || '',
      source: 'manual',
    });
    const params = buildCustomerLocationQuery({
      lat: Number(location.lat),
      lng: Number(location.lng),
      state: location.state || '',
      city: location.city || '',
      postal_code: location.postal_code || '',
    });
    this.catalog.loadStores(params);
    this.catalog.loadCategories(params);
    this.checkServiceability(params);
    this.updateLocation([name, location.city].filter(Boolean).join(', '));
    this.refreshDeliveryFeePreview();
  }

  useCurrentLocation(): void {
    this.locationService
      .initializeLocation(true)
      .then((location) => {
        if (!location) {
          this.showToast('Could not detect your location');
          return;
        }
        const params = buildCustomerLocationQuery({
          lat: location.lat,
          lng: location.lng,
          state: location.state || '',
          city: location.city || '',
          postal_code: location.postalCode || '',
        });
        this.catalog.loadStores(params);
        this.catalog.loadCategories(params);
        this.checkServiceability(params);
        this.updateLocation(this.formatLocation(location.name, location.city));
        this.showToast('Location updated');
        this.refreshDeliveryFeePreview();
      })
      .catch(() => this.showToast('Could not detect your location'));
  }

  openMiniCart(): void {
    this.miniCartOpen.set(true);
    this.ui.openMiniCart();
  }

  closeMiniCart(): void {
    this.miniCartOpen.set(false);
    this.ui.closeMiniCart();
  }

  showToast(message: string, tone?: ToastTone): void {
    const toastMessage = String(message || '').trim();
    if (!toastMessage) return;
    const resolvedTone = tone || this.inferToastTone(toastMessage);
    this.toast.set({ message: toastMessage, tone: resolvedTone });
    this.toastService.show(
      toastMessage,
      resolvedTone === 'warning' ? 'info' : resolvedTone
    );
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.set(null), 2200);
  }

  loadCart(): void {
    if (!this.auth.isLoggedIn()) {
      this.loadGuestCart();
      return;
    }
    this.cartLoaded.set(false);
    this.cartApi.getCart().subscribe({
      next: (cart: ApiCart) => {
        const items = (cart.items || []).map((item) => this.mapCartItem(item));
        this.cart.set(items);
        this.cartApi.setCartCount(items.length);
        this.cartLoaded.set(true);
        this.refreshDeliveryFeePreview();
      },
      error: () => {
        this.cart.set([]);
        this.cartApi.setCartCount(0);
        this.cartLoaded.set(true);
      },
    });
  }

  loadAddresses(): void {
    if (!this.auth.isLoggedIn()) return;
    this.accountApi.getAddresses().subscribe({
      next: (response) => {
        const addresses = this.unwrap<ApiAddress>(response).map((address) =>
          this.mapAddress(address)
        );
        this.addresses.set(addresses);
        const currentLocation = this.locationService.location();
        const nearby =
          currentLocation?.source === 'gps' &&
          Number.isFinite(currentLocation.lat) &&
          Number.isFinite(currentLocation.lng)
            ? selectNearbySavedAddress(
                {
                  latitude: currentLocation.lat,
                  longitude: currentLocation.lng,
                } satisfies GeoCoordinates,
                addresses.map((address) => ({
                  id: address.id,
                  label: address.label,
                  latitude: address.latitude,
                  longitude: address.longitude,
                  city: address.city,
                  state: address.state,
                  postalCode: address.pincode,
                  is_default: address.isDefault,
                  source: address,
                })) as Array<AddressWithCoordinates & { source: Address }>,
                0.5
              )?.source || null
            : null;
        const active =
          nearby ||
          addresses.find((address) => address.isDefault) ||
          addresses[0] ||
          null;
        this.activeAddress.set(active);
        if (active) {
          this.configureCurrencyFromAddress(active);
          this.updateLocation(
            [active.label, active.city].filter(Boolean).join(', ')
          );
          const params = buildCustomerLocationQuery({
            lat: active.latitude != null ? Number(active.latitude) : undefined,
            lng:
              active.longitude != null ? Number(active.longitude) : undefined,
            state: active.state || '',
            city: active.city || '',
            postal_code: active.pincode || '',
          });
          this.catalog.loadStores(params);
          this.catalog.loadCategories(params);
          this.checkServiceability(params);
        }
        this.refreshDeliveryFeePreview();
      },
      error: () => {
        this.addresses.set([]);
        this.activeAddress.set(null);
      },
    });
  }

  createAddress(address: Address): void {
    if (!this.auth.isLoggedIn()) {
      this.ui.openLogin();
      return;
    }
    this.accountApi.createAddress(this.addressPayload(address)).subscribe({
      next: () => {
        this.loadAddresses();
        this.showToast('Address saved');
      },
      error: (error) =>
        this.showToast(this.explainApiError(error, 'Could not save address')),
    });
  }

  updateAddress(address: Address): void {
    if (!address.id) return;
    this.accountApi
      .updateAddress(address.id, this.addressPayload(address))
      .subscribe({
        next: () => {
          this.loadAddresses();
          this.showToast('Address updated');
        },
        error: (error) =>
          this.showToast(
            this.explainApiError(error, 'Could not update address')
          ),
      });
  }

  deleteAddress(id: string): void {
    this.accountApi.deleteAddress(id).subscribe({
      next: () => {
        this.loadAddresses();
        this.showToast('Address removed');
      },
      error: (error) =>
        this.showToast(this.explainApiError(error, 'Could not remove address')),
    });
  }

  selectAddress(id: string): void {
    const address = this.addresses().find((item) => item.id === id);
    if (!address) return;
    this.activeAddress.set(address);
    this.addresses.update((items) =>
      items.map((item) => ({ ...item, isDefault: item.id === id }))
    );
    this.configureCurrencyFromAddress(address);
    if (address.latitude != null && address.longitude != null) {
      this.locationService.setManualLocation({
        lat: Number(address.latitude),
        lng: Number(address.longitude),
        name: address.city || address.label,
        city: address.city || '',
        state: address.state || '',
        postalCode: address.pincode || '',
        source: 'saved_address',
      });
      const params = buildCustomerLocationQuery({
        lat: Number(address.latitude),
        lng: Number(address.longitude),
        state: address.state || '',
        city: address.city || '',
        postal_code: address.pincode || '',
      });
      this.catalog.loadStores(params);
      this.catalog.loadCategories(params);
      this.checkServiceability(params);
    } else {
      const params = buildCustomerLocationQuery({
        state: address.state || '',
        city: address.city || '',
        postal_code: address.pincode || '',
      });
      this.catalog.loadStores(params);
      this.catalog.loadCategories(params);
      this.checkServiceability(params);
    }
    this.updateLocation(
      [address.label, address.city].filter(Boolean).join(', ')
    );
    if (address.raw)
      this.accountApi
        .updateAddress(id, { ...address.raw, is_default: true })
        .subscribe({ error: () => {} });
    this.refreshDeliveryFeePreview();
  }

  loadPaymentMethods(): void {
    if (!this.auth.isLoggedIn()) return;
    this.accountApi.getPaymentMethods().subscribe({
      next: (response) => {
        const methods =
          response.enabled_payment_methods || response.methods || [];
        const paymentMethods: PaymentMethod[] = methods.map(
          (method: any, index: number) =>
            this.mapPaymentMethod(method, index === 0)
        );
        this.paymentMethods.set(paymentMethods);
        this.selectedPaymentMethod.set(
          paymentMethods.find((method: PaymentMethod) => method.isDefault)
            ?.id ||
            paymentMethods[0]?.id ||
            ''
        );
      },
      error: () => {
        this.paymentMethods.set([]);
        this.selectedPaymentMethod.set('');
      },
    });
  }

  loadIssueOptions(): void {
    this.catalogApi.getIssueOptions().subscribe({
      next: (response) => {
        const options = Array.isArray(response)
          ? response
          : Array.isArray(response?.issue_types)
          ? response.issue_types
          : Array.isArray(response?.results)
          ? response.results
          : [];
        this.issueOptions.set(options);
      },
      error: () => this.issueOptions.set([]),
    });
  }

  checkServiceability(params?: Record<string, any>): void {
    this.serviceabilityLoading.set(true);
    this.catalogApi.checkServiceability(params).subscribe({
      next: (response) => {
        this.serviceability.set(response || null);
        this.serviceabilityLoading.set(false);
      },
      error: () => {
        this.serviceability.set({
          is_serviceable: false,
          message: 'Could not verify delivery availability for this location.',
          nearby_store_count: 0,
          instant_store_count: 0,
          eta_label: '',
        });
        this.serviceabilityLoading.set(false);
      },
    });
  }

  loadActiveOrder(): void {
    if (!this.auth.isLoggedIn()) {
      this.activeOrder.set(null);
      return;
    }
    this.customerApi
      .toObservable<any>(this.customerApi.client.orders.activeOrder())
      .subscribe({
        next: (response) =>
          this.activeOrder.set(response?.active_order || null),
        error: () => this.activeOrder.set(null),
      });
  }

  selectPayment(id: string): void {
    this.selectedPaymentMethod.set(id);
    this.paymentMethods.update((methods) =>
      methods.map((method) => ({ ...method, isDefault: method.id === id }))
    );
    this.refreshCheckoutPreview();
  }

  placeOrder(
    paymentMethodId?: string,
    options: { codUpiConfirmed?: boolean; scheduledFor?: string | null } = {}
  ): Observable<Order> {
    this.lastCheckoutError.set('');
    if (!this.auth.isLoggedIn()) {
      this.ui.openLogin();
      return throwError(
        () => new Error('Please sign in before placing your order.')
      );
    }
    if (!this.cart().length)
      return throwError(() => new Error('Your cart is empty.'));
    const address = this.activeAddress();
    if (!address?.id)
      return throwError(
        () => new Error('Select a delivery address before placing the order.')
      );
    if (!isCustomerAddressComplete(address as any))
      return throwError(
        () =>
          new Error(
            'Select or update a complete delivery address before checkout.'
          )
      );

    const selectedPayment =
      paymentMethodId || this.selectedPaymentMethod() || 'cod';
    const checkoutPaymentMethod =
      checkoutPaymentMethodForBackend(selectedPayment);
    this.selectPayment(selectedPayment);
    const payload = createCheckoutPayload({
      addressId: address.id,
      paymentMethod: checkoutPaymentMethod,
      couponCode: this.coupon(),
      confirmFarDelivery: this.requiresFarDeliveryConfirmation(),
      scheduledFor: options.scheduledFor || undefined,
    });
    payload['selected_payment_method'] = selectedPayment;
    if (selectedPayment === 'cod')
      payload['cod_upi_confirmed'] = !!options.codUpiConfirmed;

    this.checkoutSubmitting.set(true);
    if (payload['payment_method'] === 'razorpay') {
      return this.placeRazorpayOrder(payload);
    }
    return this.cartApi
      .createOrder(payload)
      .pipe(map((response) => this.finishPlacedOrder(response)));
  }

  private placeRazorpayOrder(payload: Record<string, any>): Observable<Order> {
    return new Observable<Order>((subscriber) => {
      this.cartApi
        .initiateCheckoutPayment({
          delivery_address_id: String(payload['delivery_address_id']),
          coupon_code: payload['coupon_code'],
          confirm_far_delivery: payload['confirm_far_delivery'],
          scheduled_for: payload['scheduled_for'],
        })
        .subscribe({
          next: (payment) => {
            this.paymentAdapter
              .open(payment, 'Order payment')
              .then((response: any) => {
                this.cartApi
                  .createOrder({
                    ...payload,
                    payment_method: 'razorpay',
                    razorpay_order_id: payment.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  })
                  .subscribe({
                    next: (orderResponse) => {
                      subscriber.next(this.finishPlacedOrder(orderResponse));
                      subscriber.complete();
                    },
                    error: (error) => {
                      this.checkoutSubmitting.set(false);
                      subscriber.error(error);
                    },
                  });
              })
              .catch(() => {
                this.checkoutSubmitting.set(false);
                subscriber.error(
                  new Error(
                    'Online payment is not available in this browser session.'
                  )
                );
              });
          },
          error: (error) => {
            this.checkoutSubmitting.set(false);
            subscriber.error(error);
          },
        });
    });
  }

  private finishPlacedOrder(response: any): Order {
    const raw = Array.isArray(response) ? response[0] : response;
    this.checkoutSubmitting.set(false);
    this.loadCart();
    this.loadActiveOrder();
    return this.mapOrder(raw);
  }

  private refreshDeliveryFeePreview(): void {
    const address = this.activeAddress();
    if (!this.auth.isLoggedIn() || !address?.id || !this.cart().length) {
      this.deliveryFeePreview.set(null);
      this.deliveryFeePreviewReadyAddressId.set('');
      this.requiresFarDeliveryConfirmation.set(false);
      return;
    }
    this.deliveryFeePreviewReadyAddressId.set('');
    this.cartApi.getDeliveryFeePreview(address.id).subscribe({
      next: (preview) => {
        this.deliveryFeePreview.set(preview);
        this.requiresFarDeliveryConfirmation.set(
          !!preview.requires_far_delivery_confirmation
        );
        this.deliveryFeePreviewReadyAddressId.set(address.id);
        this.refreshCheckoutPreview();
      },
      error: () => {
        this.deliveryFeePreview.set(null);
        this.deliveryFeePreviewReadyAddressId.set('');
        this.checkoutPriceBreakup.set(null);
        this.requiresFarDeliveryConfirmation.set(false);
      },
    });
  }

  getCheckoutPreview(
    paymentMethodId?: string,
    codUpiConfirmed = false,
    scheduledFor?: string | null
  ): Observable<any> {
    const address = this.activeAddress();
    if (!address?.id)
      return throwError(
        () => new Error('Select a delivery address before checkout.')
      );
    return this.cartApi.getCheckoutPreview({
      delivery_address_id: address.id,
      payment_method: checkoutPaymentMethodForBackend(
        paymentMethodId || this.selectedPaymentMethod() || 'cod'
      ),
      coupon_code: this.coupon(),
      confirm_far_delivery: this.requiresFarDeliveryConfirmation(),
      cod_upi_confirmed: codUpiConfirmed,
      scheduled_for: scheduledFor || null,
    });
  }

  private refreshCheckoutPreview(): void {
    const address = this.activeAddress();
    if (!this.auth.isLoggedIn() || !address?.id || !this.cart().length) {
      this.checkoutPriceBreakup.set(null);
      return;
    }
    if (this.deliveryFeePreviewReadyAddressId() !== address.id) {
      this.checkoutPriceBreakup.set(null);
      return;
    }
    this.cartApi
      .getCheckoutPreview({
        delivery_address_id: address.id,
        payment_method: checkoutPaymentMethodForBackend(
          this.selectedPaymentMethod() || 'cod'
        ),
        coupon_code: this.coupon(),
        confirm_far_delivery: this.requiresFarDeliveryConfirmation(),
        cod_upi_confirmed: true,
      })
      .subscribe({
        next: (preview) => {
          this.checkoutPriceBreakup.set(preview?.price_breakup || null);
        },
        error: () => this.checkoutPriceBreakup.set(null),
      });
  }

  private priceBreakupAmount(key: string): number {
    const value = Number(this.checkoutPriceBreakup()?.[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  private mapCartItem(item: ApiCartItem): CartItem {
    const product = this.catalog.mapProduct(item.product);
    return {
      ...product,
      id: product.id,
      cartItemId: item.id,
      quantity: Number(item.quantity || 0),
      subtotal: Number(item.subtotal || 0),
      rawCartItem: item,
    };
  }

  private addToGuestCart(product: Product, quantity: number): void {
    const incoming = this.guestCartItem(product, quantity);
    const current = this.cart();
    const differentStore = current.some(
      (item) =>
        (item.storeId || item.storeName) &&
        (incoming.storeId || incoming.storeName) &&
        (item.storeId || item.storeName) !==
          (incoming.storeId || incoming.storeName)
    );
    const addItem = (items: CartItem[]) => {
      this.commitGuestCart(items);
      this.lastAddedProductId.set(incoming.id);
      if (this.shouldAutoOpenMiniCart()) this.openMiniCart();
      this.showToast(`${incoming.name} added to cart`);
    };

    if (differentStore) {
      const existingStore = current[0]?.storeName || 'the current store';
      const incomingStore = incoming.storeName || 'this store';
      this.ui
        .confirm({
          title: 'Replace basket?',
          message: `Your basket has items from ${existingStore}. To order from ${incomingStore}, replace basket?`,
          confirmText: 'Replace basket',
          cancelText: 'Keep basket',
          tone: 'warning',
        })
        .then((confirmed) => {
          if (confirmed) addItem([incoming]);
        });
      return;
    }

    const existing = current.find(
      (item) => item.id === incoming.id || item.apiId === incoming.apiId
    );
    if (!existing) {
      addItem([...current, incoming]);
      return;
    }

    addItem(
      current.map((item) =>
        item === existing
          ? {
              ...item,
              quantity: item.quantity + incoming.quantity,
              subtotal: item.price * (item.quantity + incoming.quantity),
            }
          : item
      )
    );
  }

  private updateGuestCartItem(item: CartItem, nextQuantity: number): void {
    const nextItems =
      nextQuantity <= 0
        ? this.cart().filter(
            (entry) => entry.id !== item.id && entry.apiId !== item.apiId
          )
        : this.cart().map((entry) =>
            entry.id === item.id || entry.apiId === item.apiId
              ? {
                  ...entry,
                  quantity: nextQuantity,
                  subtotal: entry.price * nextQuantity,
                }
              : entry
          );
    this.commitGuestCart(nextItems);
  }

  private loadGuestCart(): void {
    this.commitGuestCart(this.readGuestCartItems(), false);
  }

  private commitGuestCart(items: CartItem[], persist = true): void {
    this.cart.set(items);
    this.cartLoaded.set(true);
    this.cartApi.setCartCount(items.length);
    this.coupon.set('');
    this.couponDiscount.set(0);
    if (persist) this.writeGuestCartItems(items);
  }

  private guestCartItem(product: Product, quantity: number): CartItem {
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    return {
      ...product,
      id: product.apiId || product.id,
      apiId: product.apiId || product.id,
      quantity: safeQuantity,
      subtotal: product.price * safeQuantity,
    };
  }

  private readGuestCartItems(): CartItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const payload = JSON.parse(
        window.localStorage.getItem(this.guestCartStorageKey) || 'null'
      ) as Partial<GuestCartPayload> | null;
      if (!payload || !Array.isArray(payload.items)) return [];
      return payload.items
        .map((item) => this.normalizeGuestCartItem(item))
        .filter((item): item is CartItem => !!item);
    } catch {
      return [];
    }
  }

  private writeGuestCartItems(items: CartItem[]): void {
    if (typeof window === 'undefined') return;
    if (!items.length) {
      window.localStorage.removeItem(this.guestCartStorageKey);
      return;
    }
    const first = items[0];
    const payload: GuestCartPayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      store: {
        id: first.storeId || '',
        name: first.storeName || 'Selected store',
      },
      items,
    };
    window.localStorage.setItem(
      this.guestCartStorageKey,
      JSON.stringify(payload)
    );
  }

  private normalizeGuestCartItem(item: any): CartItem | null {
    const id = String(item?.apiId || item?.id || '').trim();
    const name = String(item?.name || '').trim();
    if (!id || !name) return null;
    const quantity = Math.max(1, Number(item?.quantity) || 1);
    const price = Number(item?.price || 0);
    return {
      ...item,
      id,
      apiId: id,
      name,
      unit: String(item?.unit || ''),
      price: Number.isFinite(price) ? price : 0,
      mrp: Number(item?.mrp || price || 0),
      discount: String(item?.discount || ''),
      image: String(item?.image || '/assets/placeholders/product.svg'),
      category: String(item?.category || ''),
      rating: Number(item?.rating || 0),
      storeId: String(item?.storeId || ''),
      storeName: item?.storeName ? String(item.storeName) : undefined,
      quantity,
      subtotal: Number(item?.subtotal || price * quantity || 0),
      cartItemId: undefined,
      rawCartItem: undefined,
    };
  }

  private mergeGuestCartIntoBackend(done: () => void): void {
    const guestItems = this.readGuestCartItems();
    if (!guestItems.length) {
      done();
      return;
    }

    const addNext = (index: number) => {
      const item = guestItems[index];
      if (!item) {
        this.writeGuestCartItems([]);
        this.showToast('Cart synced to your account');
        done();
        return;
      }
      this.cartApi.addToCart(item.apiId || item.id, item.quantity).subscribe({
        next: () => addNext(index + 1),
        error: (error) =>
          this.handleGuestCartMergeError(error, item, index, addNext, done),
      });
    };

    addNext(0);
  }

  private handleGuestCartMergeError(
    error: any,
    item: CartItem,
    index: number,
    addNext: (index: number) => void,
    done: () => void
  ): void {
    const body = error?.body || error?.error || {};
    const message = this.explainApiError(error, 'Could not sync guest cart');
    const conflictCode = body?.code || body?.error_code;
    const isConflict =
      conflictCode === 'cart_store_conflict' ||
      message.toLowerCase().includes('cart has items from');
    if (!isConflict) {
      this.showToast(message);
      done();
      return;
    }

    const existingStore =
      body?.existing_store_name || body?.existingStoreName || 'your saved cart';
    const incomingStore =
      body?.incoming_store_name || item.storeName || 'your guest cart';
    this.ui
      .confirm({
        title: 'Replace saved basket?',
        message: `Your saved basket has items from ${existingStore}. Replace it with your guest basket from ${incomingStore}?`,
        confirmText: 'Replace basket',
        cancelText: 'Keep saved basket',
        tone: 'warning',
      })
      .then((confirmed) => {
        if (!confirmed) {
          done();
          return;
        }
        this.cartApi
          .replaceCart(item.apiId || item.id, item.quantity)
          .subscribe({
            next: () => addNext(index + 1),
            error: () => {
              this.showToast('Could not replace saved cart');
              done();
            },
          });
      });
  }

  private mapAddress(address: ApiAddress): Address {
    return normalizeSharedAddress(address as any) as Address;
  }

  private mapPaymentMethod(
    method: string | Record<string, any>,
    isDefault: boolean
  ): PaymentMethod {
    return normalizeCheckoutPaymentMethod(method, isDefault) as PaymentMethod;
  }

  private mapOrder(raw: any): Order {
    return normalizeSharedOrder(raw) as Order;
  }

  private addressPayload(address: Address): Record<string, any> {
    return createAddressPayload(address as any);
  }

  private unwrap<T>(response: any): T[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.items)) return response.items;
    return [];
  }

  private formatLocation(name: string, city?: string): string {
    return [name, city].filter(Boolean).join(', ');
  }

  private configureCurrencyFromAddress(address: Address): void {
    this.currency.configureFromLocation({
      lat: address.latitude != null ? Number(address.latitude) : undefined,
      lng: address.longitude != null ? Number(address.longitude) : undefined,
      name: [
        address.label,
        address.line,
        address.city,
        address.state,
        address.pincode,
      ]
        .filter(Boolean)
        .join(', '),
      address: address.line,
      city: address.city || '',
      state: address.state || '',
      postalCode: address.pincode || '',
      country:
        (address.raw as any)?.country ||
        (address.raw as any)?.country_code ||
        '',
      countryCode: (address.raw as any)?.country_code || '',
    });
  }

  private explainApiError(error: any, fallback: string): string {
    if (error?.status === 401)
      return 'Your session has expired. Please sign in again.';
    return mapCustomerError(
      error?.error || error,
      readApiError(error?.error || error) || fallback
    ).message;
  }

  private isStoreOpenForProduct(product: Product): boolean {
    const vendor = (product?.raw as any)?.vendor;
    if (!vendor) return true;
    return (vendor?.is_open_now ?? vendor?.is_open) !== false;
  }

  private storeClosedMessage(product: Product): string {
    const vendor = (product?.raw as any)?.vendor || {};
    const storeName = vendor?.store_name || product.storeName || 'Store';
    const opening = this.formatClockTime(vendor?.opening_time);
    const closing = this.formatClockTime(vendor?.closing_time);
    if (opening && closing) {
      return `'${storeName}' is closed right now. Open ${opening} - ${closing}.`;
    }
    return `'${storeName}' is closed right now.`;
  }

  private formatClockTime(value: string | null | undefined): string {
    const text = String(value || '').slice(0, 5);
    if (!text || !text.includes(':')) return '';
    const [hoursRaw, minutesRaw] = text
      .split(':')
      .map((part) => Number(part || 0));
    const date = new Date();
    date.setHours(hoursRaw || 0, minutesRaw || 0, 0, 0);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private shouldAutoOpenMiniCart(): boolean {
    if (!shouldOpenCartAfterAdd('add_item')) return false;
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(max-width: 760px)').matches;
  }

  private inferToastTone(message: string): ToastTone {
    const text = message.toLowerCase();
    if (
      text.includes('could not') ||
      text.includes('failed') ||
      text.includes('not available') ||
      text.includes('invalid') ||
      text.includes('expired')
    ) {
      return 'error';
    }
    if (
      text.includes('closed right now') ||
      text.includes('pending') ||
      text.includes('warning')
    ) {
      return 'warning';
    }
    if (
      text.includes('loading') ||
      text.includes('preparing') ||
      text.includes('sign in') ||
      text.includes('check')
    ) {
      return 'info';
    }
    return 'success';
  }
}
