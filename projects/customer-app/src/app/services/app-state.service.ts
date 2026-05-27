import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  selectNearbySavedAddress,
  buildCustomerLocationQuery,
  type GeoCoordinates,
  type AddressWithCoordinates,
} from '@nexconnect/customer-location';
import {
  isWalletFeatureEnabled,
  isMembershipFeatureEnabled,
} from '@nexconnect/customer-payments';
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
  Address as ApiAddress,
  Cart as ApiCart,
  CartItem as ApiCartItem,
  ApiService,
  CurrencyService,
  LocationService,
  AuthService as SharedAuthService,
} from '@shared/public-api';
import { Address, CartItem, Order, PaymentMethod, Product } from '../models';
import { CustomerAccountApiService } from './customer-account-api.service';
import { CustomerCartApiService } from './customer-cart-api.service';
import { CustomerCatalogApiService } from './customer-catalog-api.service';
import { CatalogService } from './catalog.service';
import { UiService } from './ui.service';
import { BrowserPaymentAdapter } from './adapters/browser-payment.adapter';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly accountApi = inject(CustomerAccountApiService);
  private readonly api = inject(ApiService);
  private readonly cartApi = inject(CustomerCartApiService);
  private readonly catalogApi = inject(CustomerCatalogApiService);
  private readonly catalog = inject(CatalogService);
  private readonly auth = inject(SharedAuthService);
  private readonly currency = inject(CurrencyService);
  private readonly locationService = inject(LocationService);
  private readonly ui = inject(UiService);
  private readonly paymentAdapter = inject(BrowserPaymentAdapter);
  private readonly router = inject(Router);
  private authenticatedBootstrapComplete = false;

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
  readonly toast = signal('');
  readonly miniCartOpen = signal(false);
  readonly lastAddedProductId = signal('');
  readonly checkoutSubmitting = signal(false);
  readonly lastCheckoutError = signal('');
  readonly deliveryFeePreview = signal<any>(null);
  readonly checkoutPriceBreakup = signal<Record<string, any> | null>(null);
  readonly requiresFarDeliveryConfirmation = signal(false);
  readonly cartLoaded = signal(false);

  readonly itemCount = computed(() => cartItemCount(this.cart()));
  readonly subtotal = computed(() => cartSubtotal(this.cart()));
  readonly mrpTotal = computed(() => cartMrpTotal(this.cart()));
  readonly discount = computed(() =>
    cartSavings(this.cart(), this.couponDiscount()),
  );
  readonly deliveryFee = computed(() =>
    deliveryFeeFromPreview(this.deliveryFeePreview(), !!this.cart().length),
  );
  readonly deliveryPromotion = computed(() =>
    getDeliveryPromotion({
      subtotal: this.subtotal(),
      deliveryFee: this.deliveryFee(),
      hasItems: !!this.cart().length,
    }),
  );
  readonly freeDeliveryUnlocked = computed(
    () => this.deliveryPromotion().unlocked,
  );
  readonly freeDeliveryRemaining = computed(
    () => this.deliveryPromotion().remaining,
  );
  readonly freeDeliveryProgress = computed(
    () => this.deliveryPromotion().progress,
  );
  readonly deliveryFeeLabel = computed(() =>
    this.deliveryFee() > 0
      ? this.currency.format(this.deliveryFee())
      : formatDeliveryFeeLabel(this.deliveryFee()),
  );
  readonly walletEnabled = computed(() =>
    isWalletFeatureEnabled(this.paymentMethods()),
  );
  readonly membershipEnabled = computed(() =>
    isMembershipFeatureEnabled({ membership_enabled: false }),
  );
  readonly platformFee = computed(() => this.priceBreakupAmount('platform_fee'));
  readonly handlingFee = computed(
    () =>
      this.checkoutPriceBreakup()
        ? this.priceBreakupAmount('packaging_fee')
        : handlingFeeForItems(this.cart()),
  );
  readonly smallCartFee = computed(() =>
    this.priceBreakupAmount('small_cart_fee'),
  );
  readonly taxAmount = computed(() => this.priceBreakupAmount('tax_amount'));
  readonly surgeFee = computed(() => this.priceBreakupAmount('surge_fee'));
  readonly total = computed(() =>
    this.priceBreakupAmount('final_payable') ||
      checkoutTotal({
        subtotal: this.subtotal(),
        deliveryFee: this.deliveryFee(),
        handlingFee: this.handlingFee(),
        couponDiscount: this.couponDiscount(),
      }),
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
        this.cart.set([]);
        this.cartLoaded.set(false);
        this.addresses.set([]);
        this.paymentMethods.set([]);
        this.activeAddress.set(null);
        this.selectedPaymentMethod.set('');
        this.issueOptions.set([]);
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
        this.loadCart();
        this.loadAddresses();
        this.loadPaymentMethods();
        this.loadIssueOptions();
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
    this.catalog.loadCategories(params);
    this.catalog.loadStores(params);
  }

  addToCart(product: Product, quantity = 1): boolean {
    if (!this.auth.isLoggedIn()) {
      this.ui.openLogin();
      return false;
    }
    const productId = product.apiId || product.id;
    this.cartApi.addToCart(productId, quantity).subscribe({
      next: () => {
        this.lastAddedProductId.set(product.id);
        this.loadCart();
        if (shouldOpenCartAfterAdd('add_item')) this.openMiniCart();
        this.showToast(`${product.name} added to cart`);
      },
      error: (error) => this.handleAddToCartError(error, product, quantity),
    });
    return true;
  }

  private handleAddToCartError(
    error: any,
    product: Product,
    quantity: number,
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
        `Your cart has items from ${existingStore}. Do you want to clear the cart and add items from ${incomingStore}?`;
      this.ui
        .confirm({
          title: 'Replace cart?',
          message: confirmMessage,
          confirmText: 'Clear and add',
          cancelText: 'Keep cart',
          tone: 'warning',
        })
        .then((confirmed) => {
          if (!confirmed) return;
          this.cartApi.clearCart().subscribe({
            next: () => {
              const productId = product.apiId || product.id;
              this.cartApi.addToCart(productId, quantity).subscribe({
                next: () => {
                  this.lastAddedProductId.set(product.id);
                  this.loadCart();
                  if (shouldOpenCartAfterAdd('add_item')) this.openMiniCart();
                  this.showToast(`${product.name} added to cart`);
                },
                error: (retryError) =>
                  this.showToast(
                    this.explainApiError(
                      retryError,
                      'Could not add item to cart',
                    ),
                  ),
              });
            },
            error: (clearError) =>
              this.showToast(
                this.explainApiError(clearError, 'Could not clear cart'),
              ),
          });
        });
      return;
    }
    this.showToast(message);
  }

  updateQuantity(productId: string, delta: number): void {
    const item = this.cart().find(
      (entry) => entry.id === productId || entry.apiId === productId,
    );
    if (!item?.cartItemId) return;
    const nextQuantity = item.quantity + delta;
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
      (entry) => entry.id === productId || entry.apiId === productId,
    );
    if (!item?.cartItemId) return;
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
    if (!this.auth.isLoggedIn()) return;
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
    this.coupon.set(normalized);
    this.couponDiscount.set(0);
    if (!this.auth.isLoggedIn()) return;
    this.cartApi
      .validateCoupon(
        normalized,
        this.subtotal(),
        this.activeAddress()?.id || null,
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
            this.explainApiError(error, 'Coupon is not valid for this order'),
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

  showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(''), 2200);
  }

  loadCart(): void {
    if (!this.auth.isLoggedIn()) return;
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
          this.mapAddress(address),
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
                0.5,
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
            [active.label, active.city].filter(Boolean).join(', '),
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
            this.explainApiError(error, 'Could not update address'),
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
      items.map((item) => ({ ...item, isDefault: item.id === id })),
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
    } else {
      const params = buildCustomerLocationQuery({
        state: address.state || '',
        city: address.city || '',
        postal_code: address.pincode || '',
      });
      this.catalog.loadStores(params);
      this.catalog.loadCategories(params);
    }
    this.updateLocation(
      [address.label, address.city].filter(Boolean).join(', '),
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
            this.mapPaymentMethod(method, index === 0),
        );
        this.paymentMethods.set(paymentMethods);
        this.selectedPaymentMethod.set(
          paymentMethods.find((method: PaymentMethod) => method.isDefault)
            ?.id ||
            paymentMethods[0]?.id ||
            '',
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

  selectPayment(id: string): void {
    this.selectedPaymentMethod.set(id);
    this.paymentMethods.update((methods) =>
      methods.map((method) => ({ ...method, isDefault: method.id === id })),
    );
    this.refreshCheckoutPreview();
  }

  placeOrder(
    paymentMethodId?: string,
    options: { codUpiConfirmed?: boolean; scheduledFor?: string | null } = {},
  ): Observable<Order> {
    this.lastCheckoutError.set('');
    if (!this.auth.isLoggedIn()) {
      this.ui.openLogin();
      return throwError(
        () => new Error('Please sign in before placing your order.'),
      );
    }
    if (!this.cart().length)
      return throwError(() => new Error('Your cart is empty.'));
    const address = this.activeAddress();
    if (!address?.id)
      return throwError(
        () => new Error('Select a delivery address before placing the order.'),
      );
    if (!isCustomerAddressComplete(address as any))
      return throwError(
        () =>
          new Error(
            'Select or update a complete delivery address before checkout.',
          ),
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
                    'Online payment is not available in this browser session.',
                  ),
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
    return this.mapOrder(raw);
  }

  private refreshDeliveryFeePreview(): void {
    const address = this.activeAddress();
    if (!this.auth.isLoggedIn() || !address?.id || !this.cart().length) {
      this.deliveryFeePreview.set(null);
      this.requiresFarDeliveryConfirmation.set(false);
      return;
    }
    this.cartApi.getDeliveryFeePreview(address.id).subscribe({
      next: (preview) => {
        this.deliveryFeePreview.set(preview);
        this.requiresFarDeliveryConfirmation.set(
          !!preview.requires_far_delivery_confirmation,
        );
        this.refreshCheckoutPreview();
      },
      error: () => {
        this.deliveryFeePreview.set(null);
        this.checkoutPriceBreakup.set(null);
        this.requiresFarDeliveryConfirmation.set(false);
      },
    });
  }

  getCheckoutPreview(
    paymentMethodId?: string,
    codUpiConfirmed = false,
    scheduledFor?: string | null,
  ): Observable<any> {
    const address = this.activeAddress();
    if (!address?.id)
      return throwError(
        () => new Error('Select a delivery address before checkout.'),
      );
    return this.cartApi.getCheckoutPreview({
      delivery_address_id: address.id,
      payment_method: checkoutPaymentMethodForBackend(
        paymentMethodId || this.selectedPaymentMethod() || 'cod',
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
    this.cartApi
      .getCheckoutPreview({
        delivery_address_id: address.id,
        payment_method: checkoutPaymentMethodForBackend(
          this.selectedPaymentMethod() || 'cod',
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

  private mapAddress(address: ApiAddress): Address {
    return normalizeSharedAddress(address as any) as Address;
  }

  private mapPaymentMethod(
    method: string | Record<string, any>,
    isDefault: boolean,
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
      readApiError(error?.error || error) || fallback,
    ).message;
  }
}
