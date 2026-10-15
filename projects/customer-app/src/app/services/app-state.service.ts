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
import {
  createAnalytics,
  CustomerAnalyticsEvents,
  type CustomerAnalyticsEventName,
  type CustomerAnalyticsPayloads,
} from '@nexconnect/customer-analytics';
import {
  catchError,
  concatMap,
  defer,
  finalize,
  map,
  Observable,
  throwError,
} from 'rxjs';
import {
  type Address as ApiAddress,
  type Cart as ApiCart,
  type CartItem as ApiCartItem,
} from '@shared/lib/models';
import { CurrencyService } from '@shared/lib/services/currency.service';
import { LocationService, type UserLocation } from '@shared/lib/services/location.service';
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

interface CheckoutSession {
  userId: string;
  version: number;
}

interface GuestCartPayload {
  version: 1;
  updatedAt: string;
  store?: {
    id: string;
    name: string;
  };
  fulfillment?: {
    nodeId: string;
    nodeName: string;
    promiseId: string;
    expiresAt: string;
  };
  items: CartItem[];
}

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly accountApi = inject(CustomerAccountApiService);
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
  private readonly analytics = createAnalytics();
  private readonly guestCartStorageKey = 'nextou.customer.guestCart.v1';
  private authenticatedBootstrapComplete = false;
  private toastTimer: number | null = null;
  private cartFulfillmentPromptOpen = false;
  private previousAreaChoice: {
    address: Address | null;
    location: UserLocation | null;
    label: string;
  } | null = null;

  private rememberCurrentArea(): void {
    if (!this.cart().length || this.cartFulfillmentPromptOpen) return;
    const node = this.currentServiceabilityNode();
    if (!node.id || node.id !== this.cartFulfillmentNodeId()) return;
    this.previousAreaChoice = {
      address: this.activeAddress(),
      location: this.locationService.location(),
      label: this.location(),
    };
  }

  private restoreAreaChoice(choice: NonNullable<AppStateService['previousAreaChoice']>): void {
    if (choice.address) {
      this.selectAddress(choice.address.id);
      return;
    }
    this.activeAddress.set(null);
    if (choice.location) {
      this.locationService.setManualLocation(choice.location);
      this.refreshCatalogForLocation(choice.location);
    } else {
      this.locationService.clearStoredLocation();
      this.refreshCatalogForLocation({});
    }
    this.updateLocation(choice.label);
    this.refreshDeliveryFeePreview();
  }
  private cartFulfillmentRefreshInFlight = false;
  private lastCartFulfillmentRefreshKey = '';

  readonly location = signal('Select location');
  readonly cart = signal<CartItem[]>([]);
  readonly addresses = signal<Address[]>([]);
  readonly paymentMethods = signal<PaymentMethod[]>([]);
  readonly activeAddress = signal<Address | null>(null);
  readonly selectedPaymentMethod = signal('');
  readonly coupon = signal('');
  readonly couponDiscount = signal(0);
  readonly toast = signal<AppToast | null>(null);
  readonly miniCartOpen = this.ui.miniCartOpen;
  readonly lastAddedProductId = signal('');
  readonly checkoutSubmitting = signal(false);
  readonly lastCheckoutError = signal('');
  readonly checkoutStage = signal('idle');
  readonly checkoutStageLabel = computed(
    () =>
      ((
        {
          quote: 'Checking the latest order quote…',
          'creating-session': 'Creating a secure payment session…',
          'provider-loading': 'Loading secure payment…',
          'provider-open': 'Complete payment in the provider window.',
          finalizing: 'Confirming your order…',
          unknown:
            'The submission outcome is unknown. Check the existing request before paying again.',
        } as Record<string, string>
      )[this.checkoutStage()] || this.lastCheckoutError())
  );
  readonly hasCheckoutRecovery = signal(false);
  private recoveryPayload: Record<string, any> | null = null;
  private readonly recoveryByCustomer = new Map<string, Record<string, any>>();
  private deliveryPreviewRequest = 0;
  private checkoutPreviewRequest = 0;
  private interruptedCheckout = false;
  readonly deliveryFeePreview = signal<any>(null);
  readonly checkoutPriceBreakup = signal<Record<string, any> | null>(null);
  readonly checkoutPreviewError = signal('');
  readonly checkoutPreviewErrorCode = signal('');
  readonly checkoutPreviewLoading = signal(false);
  retryCheckoutPreview(): void {
    const request = ++this.checkoutPreviewRequest;
    const sessionVersion = this.auth.sessionVersion;
    this.checkoutPriceBreakup.set(null);
    this.checkoutPreviewError.set('');
    this.checkoutPreviewErrorCode.set('');
    this.checkoutPreviewLoading.set(true);
    this.refreshDeliveryAvailability().subscribe({
      next: () => {
        if (request !== this.checkoutPreviewRequest || sessionVersion !== this.auth.sessionVersion) return;
        this.refreshCheckoutPreview();
      },
      error: (error) => {
        if (request !== this.checkoutPreviewRequest || sessionVersion !== this.auth.sessionVersion) return;
        this.checkoutPreviewLoading.set(false);
        this.checkoutPreviewErrorCode.set(this.extractApiErrorCode(error?.body || error?.error || error));
        this.checkoutPreviewError.set(this.explainApiError(error, 'Delivery and fees could not be confirmed. Try again.'));
      },
    });
  }
  readonly requiresFarDeliveryConfirmation = signal(false);
  private readonly deliveryFeePreviewReadyAddressId = signal('');
  readonly cartLoaded = signal(false);
  readonly cartError = signal('');
  readonly profileError = signal('');
  readonly profileLoading = signal(false);
  readonly addressError = signal('');
  readonly addressLoading = signal(false);
  readonly addressPending = signal('');
  readonly guestMergeError = signal('');
  readonly guestMergeRemaining = signal(0);
  private guestMergeInFlight = false;
  readonly cartMutationError = signal('');
  readonly pendingProducts = signal<string[]>([]);
  readonly serviceability = signal<CustomerServiceability | null>(null);
  readonly serviceabilityLoading = signal(false);
  readonly serviceabilityError = signal('');
  private serviceabilityRequest = 0;
  readonly deliveryUnavailable = computed(() =>
    this.isDeliveryUnavailableResponse(this.serviceability())
  );
  readonly cartFulfillmentNodeId = signal('');
  readonly cartFulfillmentNodeName = signal('');
  readonly cartFulfillmentPromiseId = signal('');
  readonly cartFulfillmentPromiseExpiresAt = signal('');
  readonly activeOrder = signal<ActiveOrderSummary | null>(null);

  readonly itemCount = computed(() => cartItemCount(this.cart()));
  readonly subtotal = computed(() => cartSubtotal(this.cart()));
  readonly mrpTotal = computed(() => cartMrpTotal(this.cart()));
  readonly discount = computed(() =>
    cartSavings(this.cart(), this.couponDiscount())
  );
  readonly deliveryFeeKnown = computed(() => {
    const address = this.activeAddress();
    if (!this.cart().length) return true;
    return (
      !!address?.id && this.deliveryFeePreviewReadyAddressId() === address.id
    );
  });
  readonly deliveryFee = computed(() =>
    this.deliveryFeeKnown()
      ? deliveryFeeFromPreview(this.deliveryFeePreview(), !!this.cart().length)
      : 0
  );
  readonly deliveryFeeLabel = computed(() => {
    if (!this.cart().length) return formatDeliveryFeeLabel(0);
    if (!this.deliveryFeeKnown()) {
      return this.activeAddress()?.id ? 'Calculating' : 'At checkout';
    }
    return this.deliveryFee() > 0
      ? this.currency.format(this.deliveryFee())
      : formatDeliveryFeeLabel(this.deliveryFee());
  });
  readonly cartStore = computed(() => this.resolveCartStore());
  readonly cartMinimumOrderAmount = computed(() =>
    this.moneyValue(this.cartStore()?.['min_order_amount'])
  );
  readonly cartMinimumOrderRemaining = computed(() =>
    Math.max(0, this.cartMinimumOrderAmount() - this.subtotal())
  );
  readonly hasMixedStoreItems = computed(() => {
    const stores = new Set(
      this.cart()
        .map((item) => item.storeId || item.storeName)
        .filter(Boolean)
    );
    return stores.size > 1;
  });
  readonly cartCheckoutBlockReason = computed(() => {
    if (!this.cart().length) return 'Your cart is empty.';
    if (this.deliveryUnavailable()) {
      return (
        this.serviceability()?.message ||
        'Delivery is not available for your selected location. Choose another location to continue.'
      );
    }
    if (this.hasMixedStoreItems()) {
      return 'Your cart has items from more than one store. Please keep one store per order.';
    }
    const fulfillmentIssue = this.cartFulfillmentIssue();
    if (fulfillmentIssue) return fulfillmentIssue;
    const remaining = this.cartMinimumOrderRemaining();
    if (remaining > 0) {
      const storeName =
        this.cartStore()?.['store_name'] ||
        this.cart()[0]?.storeName ||
        'this store';
      return `Add ${this.currency.format(
        remaining
      )} more to meet ${storeName}'s minimum order.`;
    }
    const storeIssue = this.cartStoreAvailabilityIssue();
    if (storeIssue) return storeIssue;
    return '';
  });
  readonly cartFulfillmentMismatch = computed(
    () => !!this.cartFulfillmentIssue()
  );
  readonly cartFulfillmentMismatchMessage = computed(
    () => this.cartFulfillmentIssue() || ''
  );
  readonly canCheckoutCart = computed(() => !this.cartCheckoutBlockReason());
  readonly platformFee = computed(() =>
    this.priceBreakupAmount('platform_fee')
  );
  readonly handlingFee = computed(() => this.priceBreakupAmount('packaging_fee'));
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
        this.restoreCheckoutRecovery();
        this.bootstrapAuthenticatedState();
      } else {
        this.ui.resolveConfirm(false);
        this.guestMergeInFlight = false;
        this.guestMergeError.set('');
        this.guestMergeRemaining.set(0);
        this.authenticatedBootstrapComplete = false;
        this.profileLoading.set(false);
        this.recoveryPayload = null;
        this.hasCheckoutRecovery.set(false);
        this.checkoutStage.set('idle');
        this.checkoutSubmitting.set(false);
        this.lastCheckoutError.set('');
        this.ui.closeEdit();
        this.ui.closeLocation();
        this.addressPending.set('');
        this.pendingProducts.set([]);
        this.couponPending.set(false);
        this.couponError.set('');
        this.loadGuestCart();
        this.addresses.set([]);
        this.paymentMethods.set([]);
        this.activeAddress.set(null);
        this.previousAreaChoice = null;
        this.selectedPaymentMethod.set('');
        this.activeOrder.set(null);
        ++this.activeOrderRequest;
        this.activeOrderError.set('');
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
    const sessionVersion = this.auth.sessionVersion;
    if (this.authenticatedBootstrapComplete) return;
    this.authenticatedBootstrapComplete = true;
    this.profileLoading.set(true);
    this.profileError.set('');
    this.accountApi.getProfile().subscribe({
      next: (user) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.profileLoading.set(false);
        this.profileError.set('');
        this.auth.updateUserData(user);
        this.mergeGuestCartIntoBackend(() => this.loadCart());
        this.loadAddresses();
        this.loadPaymentMethods();
        this.loadActiveOrder();
      },
      error: (error) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.profileLoading.set(false);
        this.authenticatedBootstrapComplete = false;
        this.profileError.set(
          this.explainApiError(
            error,
            'Your profile could not load. Retry to restore account details.'
          )
        );
        if (error?.status === 401) this.auth.clearInvalidSession();
      },
    });
  }

  retryProfile(): void {
    this.bootstrapAuthenticatedState();
  }

  retryGuestMerge(): void {
    if (!this.auth.isLoggedIn() || this.guestMergeInFlight) return;
    this.mergeGuestCartIntoBackend(() => this.loadCart());
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

  addToCart(
    product: Product,
    quantity = 1,
    complete?: (success: boolean) => void
  ): boolean {
    const sessionVersion = this.auth.sessionVersion;
    const id = product.apiId || product.id;
    if (this.pendingProducts().includes(id) || this.cartError()) {
      complete?.(false);
      return false;
    }
    this.cartMutationError.set('');
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const stock = Number(product.raw?.stock);
    const current =
      this.cart().find((item) => (item.apiId || item.id) === id)?.quantity || 0;
    if (Number.isFinite(stock) && current + quantity > stock) {
      this.cartMutationError.set(
        'The requested quantity exceeds current stock.'
      );
      complete?.(false);
      return false;
    }
    const finish = (success: boolean) => {
      if (sessionVersion !== this.auth.sessionVersion) return;
      this.pendingProducts.update((ids) => ids.filter((key) => key !== id));
      complete?.(success);
    };
    const serviceability = this.serviceability();
    if (this.isDeliveryUnavailableResponse(serviceability)) {
      this.catalog.clearDeliverableCatalog();
      this.showToast(
        serviceability?.message ||
          'Delivery is not available for your selected location. Choose another location to continue.',
        'warning'
      );
      complete?.(false);
      return false;
    }
    if (!this.isStoreOpenForProduct(product)) {
      this.showToast(this.storeClosedMessage(product));
      complete?.(false);
      return false;
    }
    if (!this.auth.isLoggedIn()) {
      this.pendingProducts.update((ids) => [...ids, id]);
      this.addToGuestCart(product, quantity, finish);
      return true;
    }
    this.pendingProducts.update((ids) => [...ids, id]);
    const productId = product.apiId || product.id;
    this.cartApi
      .addToCart(productId, quantity, this.cartFulfillmentContext())
      .subscribe({
        next: () => {
          if (sessionVersion !== this.auth.sessionVersion) return;
          this.lastAddedProductId.set(product.id);
          this.loadCart(
            () => finish(true),
            () => finish(false)
          );
          if (this.shouldAutoOpenMiniCart()) this.openMiniCart();
          this.showToast(`${product.name} added to cart`);
        },
        error: (error) => {
          if (sessionVersion !== this.auth.sessionVersion) return;
          this.handleAddToCartError(error, product, quantity, finish, trigger);
        },
      });
    return true;
  }

  private handleAddToCartError(
    error: any,
    product: Product,
    quantity: number,
    complete?: (success: boolean) => void,
    trigger?: HTMLElement | null
  ): void {
    const sessionVersion = this.auth.sessionVersion;
    const body = error?.body || error?.error || {};
    const message = this.explainApiError(error, 'Could not add item to cart');
    const conflictCode = body?.code || body?.error_code;
    if (
      conflictCode === 'cart_store_conflict' ||
      conflictCode === 'cart_fulfillment_conflict' ||
      message.toLowerCase().includes('cart has items from')
    ) {
      const existingStore =
        body?.existing_store_name ||
        body?.existingStoreName ||
        body?.existing_fulfillment_node_name ||
        'the current store';
      const incomingStore =
        body?.incoming_store_name ||
        body?.incoming_fulfillment_node_name ||
        product.storeName ||
        'this store';
      const conflictPayload = {
        existingNodeId: String(body?.existing_fulfillment_node_id || ''),
        existingNodeName: String(
          body?.existing_fulfillment_node_name || existingStore || ''
        ),
        incomingNodeId: String(body?.incoming_fulfillment_node_id || ''),
        incomingNodeName: String(
          body?.incoming_fulfillment_node_name || incomingStore || ''
        ),
        trigger: 'add_to_cart' as const,
        itemCount: this.itemCount(),
      };
      this.trackCartFulfillmentEvent(
        CustomerAnalyticsEvents.CartFulfillmentConflict,
        conflictPayload
      );
      this.ui
        .confirm({
          title: conflictCode === 'cart_fulfillment_conflict' ? 'A new area. A fresh basket?' : 'Switch to a different store?',
          eyebrow: 'Keep your basket clear',
          message: conflictCode === 'cart_fulfillment_conflict'
            ? `This delivery point uses ${incomingStore}. Keep your current area and basket, or explicitly start a new basket here.`
            : `Your basket is from ${existingStore}. The new item belongs to ${incomingStore}. We do not mix stores in one order.`,
          artIcon: conflictCode === 'cart_fulfillment_conflict' ? 'pin' : 'bag',
          basketComparison: {count:this.itemCount(),subtotal:this.subtotal()},
          notice: 'Replacing a basket is a separate, explicit action. Cancelling this dialog leaves the original basket unchanged.',
          confirmText: 'Start new basket',
          confirmIcon: 'arrow',
          cancelText: 'Keep my basket',
          tone: 'warning',
        }, trigger)
        .then((confirmed) => {
          if (sessionVersion !== this.auth.sessionVersion) return;
          if (!confirmed) {
            this.trackCartFulfillmentEvent(
              CustomerAnalyticsEvents.CartFulfillmentKept,
              {
                previousNodeId: conflictPayload.existingNodeId,
                previousNodeName: conflictPayload.existingNodeName,
                nextNodeId: conflictPayload.incomingNodeId,
                nextNodeName: conflictPayload.incomingNodeName,
                trigger: 'replace_cart',
                itemCount: this.itemCount(),
              }
            );
            complete?.(false);
            return;
          }
          this.trackCartFulfillmentEvent(
            CustomerAnalyticsEvents.CartFulfillmentInvalidated,
            {
              previousNodeId: conflictPayload.existingNodeId,
              previousNodeName: conflictPayload.existingNodeName,
              nextNodeId: conflictPayload.incomingNodeId,
              nextNodeName: conflictPayload.incomingNodeName,
              trigger: 'replace_cart',
              itemCount: this.itemCount(),
            }
          );
          const productId = product.apiId || product.id;
          this.cartApi
            .replaceCart(productId, quantity, this.cartFulfillmentContext())
            .subscribe({
              next: () => {
                if (sessionVersion !== this.auth.sessionVersion) return;
                this.lastAddedProductId.set(product.id);
                this.loadCart(
                  () => complete?.(true),
                  () => complete?.(false)
                );
                if (this.shouldAutoOpenMiniCart()) this.openMiniCart();
                this.showToast(`${product.name} added to cart`);
              },
              error: (replaceError) => {
                if (sessionVersion !== this.auth.sessionVersion) return;
                this.cartMutationError.set(
                  this.explainApiError(replaceError, 'Could not replace basket')
                );
                complete?.(false);
              },
            });
        });
      return;
    }
    this.cartMutationError.set(message);
    this.showToast(message, 'error');
    complete?.(false);
  }

  cartItemPending(item: CartItem): boolean {
    return this.pendingProducts().includes(item.apiId || item.id);
  }

  canIncreaseCartItem(item: CartItem): boolean {
    const stock = Number(item.raw?.stock);
    return (
      !this.cartItemPending(item) &&
      (!Number.isFinite(stock) || item.quantity < stock)
    );
  }

  updateQuantity(productId: string, delta: number): void {
    const item = this.cart().find(
      (entry) => entry.id === productId || entry.apiId === productId
    );
    if (!item || this.cartItemPending(item) || this.cartError()) return;
    this.cartMutationError.set('');
    const nextQuantity = item.quantity + delta;
    if (delta > 0 && !this.canIncreaseCartItem(item)) {
      this.cartMutationError.set(
        'The requested quantity exceeds current stock.'
      );
      return;
    }
    if (!this.auth.isLoggedIn() || !item.cartItemId) {
      this.updateGuestCartItem(item, nextQuantity);
      return;
    }
    const id = item.apiId || item.id;
    const sessionVersion = this.auth.sessionVersion;
    this.pendingProducts.update((ids) => [...ids, id]);
    const finish = () =>
      this.pendingProducts.update((ids) => ids.filter((key) => key !== id));
    const request =
      nextQuantity <= 0
        ? this.cartApi.removeCartItem(item.cartItemId)
        : this.cartApi.updateCartItem(item.cartItemId, nextQuantity);
    request.subscribe({
      next: () => {
        if (sessionVersion === this.auth.sessionVersion)
          this.loadCart(finish, finish);
      },
      error: (error) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        finish();
        this.cartMutationError.set(
          this.explainApiError(error, 'Could not update your basket.')
        );
      },
    });
  }

  removeItem(productId: string): void {
    const item = this.cart().find(
      (entry) => entry.id === productId || entry.apiId === productId
    );
    if (item) this.updateQuantity(productId, -item.quantity);
  }

  clearCart(): void {
    if (!this.auth.isLoggedIn()) {
      this.commitGuestCart([]);
      return;
    }
    const sessionVersion = this.auth.sessionVersion;
    this.cartApi.clearCart().subscribe({
      next: () => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.cart.set([]);
        this.setCartFulfillmentLock('', '');
        this.cartApi.refreshCartCount();
      },
      error: (error) => {
        if (sessionVersion === this.auth.sessionVersion)
          this.showToast(this.explainApiError(error, 'Could not clear cart'));
      },
    });
  }

  clearStaleFulfillmentCart(): void {
    const fulfillment = this.currentServiceabilityFulfillment();
    this.trackCartFulfillmentEvent(
      CustomerAnalyticsEvents.CartFulfillmentInvalidated,
      {
        previousNodeId: this.cartFulfillmentNodeId(),
        previousNodeName: this.cartFulfillmentNodeName(),
        nextNodeId: fulfillment.nodeId,
        nextNodeName: fulfillment.nodeName,
        trigger: 'stale_banner',
        itemCount: this.itemCount(),
      }
    );
    this.clearCart();
  }

  couponError = signal('');
  couponPending = signal(false);
  applyCoupon(code: string): void {
    if (this.couponPending()) return;
    this.couponError.set('');
    const validationError = validateCode(code, 'Coupon code');
    if (validationError) {
      this.couponError.set(validationError);
      return;
    }
    if (!this.auth.isLoggedIn()) {
      this.couponError.set('Sign in to apply a coupon.');
      this.ui.openLogin();
      return;
    }
    this.couponPending.set(true);
    const sessionVersion = this.auth.sessionVersion;
    const normalized = compact(code).toUpperCase();
    this.cartApi
      .validateCoupon(
        normalized,
        this.subtotal(),
        this.activeAddress()?.id || null
      )
      .subscribe({
        next: (coupon) => {
          if (sessionVersion !== this.auth.sessionVersion) return;
          this.couponPending.set(false);
          this.coupon.set(coupon.code || normalized);
          this.couponDiscount.set(Number(coupon.discount || 0));
          this.refreshCheckoutPreview();
          this.showToast(`${this.coupon()} applied`);
        },
        error: (error) => {
          if (sessionVersion !== this.auth.sessionVersion) return;
          this.couponPending.set(false);
          this.couponError.set(this.explainCouponError(error));
        },
      });
  }

  updateLocation(value: string): void {
    this.location.set(value);
  }

  customerLocationQuery(): Record<string, string | number> {
    const address = this.activeAddress();
    if (address?.latitude != null && address?.longitude != null) {
      return buildCustomerLocationQuery({
        lat: Number(address.latitude),
        lng: Number(address.longitude),
        state: address.state || '',
        city: address.city || '',
        postal_code: address.pincode || '',
      });
    }
    const location = this.locationService.location();
    return buildCustomerLocationQuery({
      lat: location?.lat,
      lng: location?.lng,
      state: location?.state || '',
      city: location?.city || '',
      postal_code: location?.postalCode || '',
    });
  }

  private cartFulfillmentContext(): Record<string, string> {
    const serviceability = this.serviceability();
    const nodeId =
      serviceability?.promise?.fulfillment_node_id ||
      serviceability?.fulfillment_node?.id ||
      this.cartFulfillmentNodeId() ||
      '';
    const promiseId =
      serviceability?.promise?.id || this.cartFulfillmentPromiseId() || '';
    const expiresAt =
      serviceability?.promise?.expires_at ||
      this.cartFulfillmentPromiseExpiresAt() ||
      '';
    return {
      ...(nodeId ? { fulfillment_node_id: String(nodeId) } : {}),
      ...(promiseId ? { fulfillment_promise_id: String(promiseId) } : {}),
      ...(expiresAt
        ? { fulfillment_promise_expires_at: String(expiresAt) }
        : {}),
    };
  }

  private setCartFulfillmentLock(
    nodeId: string,
    nodeName = '',
    promiseId = '',
    expiresAt = ''
  ): void {
    this.cartFulfillmentNodeId.set(String(nodeId || ''));
    this.cartFulfillmentNodeName.set(String(nodeName || ''));
    this.cartFulfillmentPromiseId.set(String(promiseId || ''));
    this.cartFulfillmentPromiseExpiresAt.set(String(expiresAt || ''));
  }

  private currentServiceabilityFulfillment(): {
    nodeId: string;
    nodeName: string;
    promiseId: string;
    expiresAt: string;
  } {
    const serviceability = this.serviceability();
    const node = serviceability?.fulfillment_node;
    const nodeId = String(
      serviceability?.promise?.fulfillment_node_id || node?.id || ''
    );
    const nodeName = String(
      node?.name || serviceability?.nearest_store?.store_name || ''
    );
    return {
      nodeId,
      nodeName,
      promiseId: String(serviceability?.promise?.id || ''),
      expiresAt: String(serviceability?.promise?.expires_at || ''),
    };
  }

  private currentServiceabilityNode(): { id: string; name: string } {
    const fulfillment = this.currentServiceabilityFulfillment();
    return { id: fulfillment.nodeId, name: fulfillment.nodeName };
  }

  private cartFulfillmentIssue(): string {
    const cartNodeId = this.cartFulfillmentNodeId();
    const currentNode = this.currentServiceabilityNode();
    if (!cartNodeId || !currentNode.id || cartNodeId === currentNode.id) {
      return '';
    }
    const cartNodeName =
      this.cartFulfillmentNodeName() || 'your previous delivery area';
    const nextNodeName = currentNode.name || 'this delivery area';
    return `Your cart belongs to ${cartNodeName}. Clear it to shop from ${nextNodeName}.`;
  }

  private reconcileCartForServiceability(
    serviceability: CustomerServiceability | null
  ): void {
    if (this.serviceabilityLoading() || !serviceability?.is_serviceable || !this.cart().length) return;
    const cartNodeId = this.cartFulfillmentNodeId();
    const currentNode = this.currentServiceabilityNode();
    if (!cartNodeId || !currentNode.id || cartNodeId === currentNode.id) {
      this.previousAreaChoice = null;
      this.refreshCartFulfillmentForServiceability(serviceability);
      return;
    }
    if (this.cartFulfillmentPromptOpen) return;
    this.cartFulfillmentPromptOpen = true;
    const previousChoice = this.previousAreaChoice;
    const request = this.serviceabilityRequest;
    const sessionVersion = this.auth.sessionVersion;
    const cartNodeName =
      this.cartFulfillmentNodeName() || 'your previous delivery area';
    const nextNodeName = currentNode.name || 'this delivery area';
    const eventPayload = {
      previousNodeId: cartNodeId,
      previousNodeName: this.cartFulfillmentNodeName(),
      nextNodeId: currentNode.id,
      nextNodeName: currentNode.name,
      itemCount: this.itemCount(),
    };
    this.trackCartFulfillmentEvent(
      CustomerAnalyticsEvents.CartFulfillmentConflict,
      {
        existingNodeId: eventPayload.previousNodeId,
        existingNodeName: eventPayload.previousNodeName,
        incomingNodeId: eventPayload.nextNodeId,
        incomingNodeName: eventPayload.nextNodeName,
        trigger: 'location_change',
        itemCount: eventPayload.itemCount,
      }
    );
    this.ui
      .confirm({
        eyebrow: 'Keep your basket clear',
        artIcon: 'pin',
        title: 'A new area. A fresh basket?',
        message: `This delivery point is served by ${nextNodeName}, while your basket belongs to ${cartNodeName}. Keep your current area and basket, or explicitly start a new basket here.`,
        confirmText: 'Start new basket',
        cancelText: 'Keep my basket',
        basketComparison: { count: this.itemCount(), subtotal: this.subtotal() },
        notice: 'Replacing a basket is a separate, explicit action. Cancelling this dialog leaves the original basket unchanged.',
        confirmIcon: 'arrow',
        tone: 'warning',
      })
      .then((confirmed) => {
        this.cartFulfillmentPromptOpen = false;
        if (sessionVersion !== this.auth.sessionVersion || request !== this.serviceabilityRequest) return;
        this.previousAreaChoice = null;
        if (confirmed) {
          this.trackCartFulfillmentEvent(
            CustomerAnalyticsEvents.CartFulfillmentInvalidated,
            {
              ...eventPayload,
              trigger: 'location_change',
            }
          );
          this.clearCart();
          return;
        }
        this.trackCartFulfillmentEvent(
          CustomerAnalyticsEvents.CartFulfillmentKept,
          {
            ...eventPayload,
            trigger: 'location_change',
          }
        );
        if (previousChoice) this.restoreAreaChoice(previousChoice);
        this.showToast('Keeping your current area and basket');
      });
  }

  private refreshCartFulfillmentForServiceability(
    serviceability: CustomerServiceability | null
  ): void {
    if (!serviceability?.is_serviceable || !this.cart().length) return;
    const fulfillment = this.currentServiceabilityFulfillment();
    const cartNodeId = this.cartFulfillmentNodeId();
    if (
      !cartNodeId ||
      !fulfillment.nodeId ||
      cartNodeId !== fulfillment.nodeId
    ) {
      return;
    }
    if (!fulfillment.promiseId && !fulfillment.expiresAt) return;
    if (
      this.cartFulfillmentPromiseId() === fulfillment.promiseId &&
      this.cartFulfillmentPromiseExpiresAt() === fulfillment.expiresAt
    ) {
      return;
    }

    const refreshKey = [
      fulfillment.nodeId,
      fulfillment.promiseId,
      fulfillment.expiresAt,
    ].join('|');
    if (
      this.cartFulfillmentRefreshInFlight ||
      this.lastCartFulfillmentRefreshKey === refreshKey
    ) {
      return;
    }

    this.lastCartFulfillmentRefreshKey = refreshKey;
    this.cartFulfillmentRefreshInFlight = true;
    if (!this.auth.isLoggedIn()) {
      this.setCartFulfillmentLock(
        fulfillment.nodeId,
        fulfillment.nodeName,
        fulfillment.promiseId,
        fulfillment.expiresAt
      );
      this.commitGuestCart(this.cart());
      this.trackCartFulfillmentEvent(
        CustomerAnalyticsEvents.CartFulfillmentRehydrated,
        {
          nodeId: fulfillment.nodeId,
          nodeName: fulfillment.nodeName,
          promiseId: fulfillment.promiseId,
          expiresAt: fulfillment.expiresAt,
          itemCount: this.itemCount(),
        }
      );
      this.cartFulfillmentRefreshInFlight = false;
      return;
    }

    this.cartApi
      .refreshFulfillmentLock(this.cartFulfillmentContext())
      .subscribe({
        next: (cart: ApiCart) => {
          this.setCartFulfillmentLock(
            String((cart as any).fulfillment_node_id || fulfillment.nodeId),
            String((cart as any).fulfillment_node_name || fulfillment.nodeName),
            String(
              (cart as any).fulfillment_promise_id || fulfillment.promiseId
            ),
            String(
              (cart as any).fulfillment_promise_expires_at ||
                fulfillment.expiresAt
            )
          );
          this.trackCartFulfillmentEvent(
            CustomerAnalyticsEvents.CartFulfillmentRehydrated,
            {
              nodeId: this.cartFulfillmentNodeId(),
              nodeName: this.cartFulfillmentNodeName(),
              promiseId: this.cartFulfillmentPromiseId(),
              expiresAt: this.cartFulfillmentPromiseExpiresAt(),
              itemCount: this.itemCount(),
            }
          );
          this.cartFulfillmentRefreshInFlight = false;
        },
        error: (error) => {
          this.lastCartFulfillmentRefreshKey = '';
          this.cartFulfillmentRefreshInFlight = false;
          const reason = this.explainApiError(
            error,
            'Could not refresh delivery promise'
          );
          this.trackCartFulfillmentEvent(
            CustomerAnalyticsEvents.CartFulfillmentRefreshFailed,
            {
              nodeId: fulfillment.nodeId,
              nodeName: fulfillment.nodeName,
              promiseId: fulfillment.promiseId,
              reason,
              itemCount: this.itemCount(),
            }
          );
          this.showToast(reason, 'warning');
        },
      });
  }

  private trackCartFulfillmentEvent<TName extends CustomerAnalyticsEventName>(
    name: TName,
    payload: CustomerAnalyticsPayloads[TName]
  ): void {
    try {
      this.analytics.track(name, payload);
    } catch {
      // Analytics must never block cart recovery.
    }
    if (!this.auth.isLoggedIn()) return;
    const eventType = String(name).replace(/^customer_/, '');
    this.cartApi
      .recordFulfillmentEvent(eventType, payload as Record<string, unknown>)
      .subscribe({
        error: () => undefined,
      });
  }

  selectMapLocation(location: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  }): void {
    this.rememberCurrentArea();
    this.activeAddress.set(null);
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
    this.refreshCatalogForLocation({
      lat: Number(location.lat),
      lng: Number(location.lng),
      state: location.state || '',
      city: location.city || '',
      postalCode: location.postal_code || '',
    });
    this.updateLocation([name, location.city].filter(Boolean).join(', '));
    this.refreshDeliveryFeePreview();
  }

  useCurrentLocation(): void {
    this.rememberCurrentArea();
    const sessionVersion = this.auth.sessionVersion;
    this.locationService
      .initializeLocation(true)
      .then((location) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        if (!location) {
          this.showToast('Could not detect your location');
          return;
        }
        this.activeAddress.set(null);
        this.refreshCatalogForLocation(location);
        this.updateLocation(this.formatLocation(location.name, location.city));
        this.showToast('Location updated');
        this.refreshDeliveryFeePreview();
      })
      .catch(() => this.showToast('Could not detect your location'));
  }

  openMiniCart(): void {
    this.ui.openMiniCart();
  }

  closeMiniCart(): void {
    this.miniCartOpen.set(false);
    this.ui.closeMiniCart();
  }

  showToast(message: unknown, tone?: ToastTone): void {
    const toastMessage = this.normalizeToastMessage(message);
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

  private normalizeToastMessage(message: unknown): string {
    if (typeof message === 'boolean') {
      return message ? 'Done' : '';
    }
    if (message == null) return '';
    if (typeof message === 'object') {
      return readApiError(message).trim();
    }
    const text = String(message).trim();
    if (text === 'true') return 'Done';
    if (text === 'false') return '';
    return text;
  }

  private isDeliveryUnavailableResponse(
    serviceability: CustomerServiceability | null | undefined
  ): boolean {
    if (!serviceability) return false;
    if (serviceability.is_serviceable === false) return true;
    const message = String(serviceability.message || '').toLowerCase();
    return (
      message.includes('delivery is no longer available') ||
      message.includes('please refresh availability') ||
      message.includes('choose your location again')
    );
  }

  loadCart(onDone?: () => void, onError?: () => void): void {
    const sessionVersion = this.auth.sessionVersion;
    this.cartError.set('');
    if (!this.auth.isLoggedIn()) {
      this.loadGuestCart();
      onDone?.();
      return;
    }
    this.cartLoaded.set(false);
    this.cartApi.getCart().subscribe({
      next: (cart: ApiCart) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        const items = (cart.items || []).map((item) => this.mapCartItem(item));
        this.cart.set(items);
        this.setCartFulfillmentLock(
          String((cart as any).fulfillment_node_id || ''),
          String((cart as any).fulfillment_node_name || ''),
          String((cart as any).fulfillment_promise_id || ''),
          String((cart as any).fulfillment_promise_expires_at || '')
        );
        this.cartApi.setCartCount(items.length);
        this.cartLoaded.set(true);
        this.reconcileCartForServiceability(this.serviceability());
        this.refreshDeliveryFeePreview();
        onDone?.();
        if (
          this.interruptedCheckout &&
          !this.guestMergeError() &&
          !this.cartCheckoutBlockReason()
        )
          this.proceedToCheckout();
      },
      error: () => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.cartError.set(
          'Your basket could not refresh. Try again before making another change.'
        );
        onError?.();
        this.cartLoaded.set(true);
      },
    });
  }

  private addressRequest = 0;
  loadAddresses(): void {
    const request = ++this.addressRequest;
    const sessionVersion = this.auth.sessionVersion;
    if (!this.auth.isLoggedIn()) return;
    this.addressLoading.set(true);
    this.addressError.set('');
    this.accountApi.getAddresses().subscribe({
      next: (response) => {
        if (
          sessionVersion !== this.auth.sessionVersion ||
          request !== this.addressRequest
        )
          return;
        const addresses = this.unwrap<ApiAddress>(response).map((address) =>
          this.mapAddress(address)
        );
        this.addressLoading.set(false);
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
          addresses.find(
            (address) => address.id === this.activeAddress()?.id
          ) ||
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
        if (
          sessionVersion !== this.auth.sessionVersion ||
          request !== this.addressRequest
        )
          return;
        this.addressLoading.set(false);
        this.addressError.set('Saved addresses could not load. Try again.');
      },
    });
  }

  createAddress(
    address: Address,
    callbacks: { next?: () => void; error?: (error: any) => void } = {}
  ): void {
    if (!this.auth.isLoggedIn()) {
      this.ui.openLogin();
      return;
    }
    const sessionVersion = this.auth.sessionVersion;
    this.accountApi.createAddress(this.addressPayload(address)).subscribe({
      next: () => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.loadAddresses();
        this.showToast('Address saved');
        callbacks.next?.();
      },
      error: (error) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.showToast(this.explainApiError(error, 'Could not save address'));
        callbacks.error?.(error);
      },
    });
  }

  updateAddress(
    address: Address,
    callbacks: { next?: () => void; error?: (error: any) => void } = {}
  ): void {
    const sessionVersion = this.auth.sessionVersion;
    if (!address.id) return;
    this.accountApi
      .updateAddress(address.id, this.addressPayload(address))
      .subscribe({
        next: () => {
          if (sessionVersion !== this.auth.sessionVersion) return;
          this.loadAddresses();
          this.showToast('Address updated');
          callbacks.next?.();
        },
        error: (error) => {
          if (sessionVersion !== this.auth.sessionVersion) return;
          this.showToast(
            this.explainApiError(error, 'Could not update address')
          );
          callbacks.error?.(error);
        },
      });
  }

  deleteAddress(id: string): void {
    const sessionVersion = this.auth.sessionVersion;
    this.accountApi.deleteAddress(id).subscribe({
      next: () => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.loadAddresses();
        this.showToast('Address removed');
      },
      error: (error) => {
        if (sessionVersion === this.auth.sessionVersion)
          this.showToast(
            this.explainApiError(error, 'Could not remove address')
          );
      },
    });
  }

  selectAddress(id: string): void {
    const address = this.addresses().find((item) => item.id === id);
    if (!address) return;
    this.rememberCurrentArea();
    this.activeAddress.set(address);

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
      this.refreshCatalogForLocation({
        lat: Number(address.latitude),
        lng: Number(address.longitude),
        state: address.state || '',
        city: address.city || '',
        postalCode: address.pincode || '',
      });
    } else {
      this.refreshCatalogForLocation({
        state: address.state || '',
        city: address.city || '',
        postalCode: address.pincode || '',
      });
    }
    this.updateLocation(
      [address.label, address.city].filter(Boolean).join(', ')
    );

    this.refreshDeliveryFeePreview();
  }

  setDefaultAddress(id: string, retryTrigger?: HTMLElement): void {
    if (this.addressPending()) return;
    const sessionVersion = this.auth.sessionVersion;
    this.addressPending.set(id);
    this.addressError.set('');
    this.accountApi.makeDefaultAddress(id).subscribe({
      next: () => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.addressPending.set('');
        this.loadAddresses();
        this.showToast('Default address updated');
      },
      error: (error) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.addressPending.set('');
        this.addressError.set(
          this.explainApiError(error, 'Could not change the default address.')
        );
          requestAnimationFrame(() => {
            if (sessionVersion === this.auth.sessionVersion && retryTrigger?.isConnected) retryTrigger.focus();
          });
      },
    });
  }

  paymentMethodsLoading = signal(false);
  paymentMethodsError = signal('');
  activeOrderError = signal('');
  loadPaymentMethods(): void {
    const sessionVersion = this.auth.sessionVersion;
    if (!this.auth.isLoggedIn()) return;
    this.paymentMethodsLoading.set(true);
    this.paymentMethodsError.set('');
    this.accountApi.getPaymentMethods().subscribe({
      next: (response) => {
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.paymentMethodsLoading.set(false);
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
        if (sessionVersion !== this.auth.sessionVersion) return;
        this.paymentMethodsLoading.set(false);
        this.paymentMethodsError.set(
          'Payment methods could not refresh. Please retry before submitting.'
        );
      },
    });
  }

  checkServiceability(params?: Record<string, any>): void {
    const request = ++this.serviceabilityRequest;
    this.serviceability.set(null);
    this.serviceabilityError.set('');
    this.serviceabilityLoading.set(true);
    this.catalogApi.checkServiceability(params).subscribe({
      next: (response) => {
        if (request !== this.serviceabilityRequest) return;
        this.serviceability.set(response || null);
        if (this.isDeliveryUnavailableResponse(response || null)) {
          this.catalog.clearDeliverableCatalog();
        }
        this.serviceabilityLoading.set(false);
        this.reconcileCartForServiceability(response || null);
      },
      error: (error) => {
        if (request !== this.serviceabilityRequest) return;
        this.serviceability.set(null);
        this.serviceabilityError.set(
          this.explainApiError(
            error,
            'Could not check this delivery area. Try again.'
          )
        );
        this.serviceabilityLoading.set(false);
      },
    });
  }

  refreshDeliveryAvailability(): Observable<any> {
    const sessionVersion = this.auth.sessionVersion;
    const locationQuery = this.customerLocationQuery();
    const current = () => sessionVersion === this.auth.sessionVersion && JSON.stringify(locationQuery) === JSON.stringify(this.customerLocationQuery());
    return this.catalogApi
      .checkServiceability(locationQuery)
      .pipe(
        concatMap((response) => {
          if (!current()) return throwError(() => new Error('Delivery address or customer session changed. Retry for the current address.'));
          if (!response?.is_serviceable)
            return throwError(
              () =>
                new Error(
                  response?.message ||
                    'Delivery is unavailable for this address.'
                )
            );
          const nodeId = String(
            response.promise?.fulfillment_node_id ||
              response.fulfillment_node?.id ||
              ''
          );
          if (
            this.cartFulfillmentNodeId() &&
            nodeId !== this.cartFulfillmentNodeId()
          )
            return throwError(
              () =>
                new Error(
                  'This basket belongs to another delivery area. Review your basket before continuing.'
                )
            );
          this.serviceability.set(response);
          return this.cartApi
            .refreshFulfillmentLock(this.cartFulfillmentContext())
            .pipe(
              map((cart) => {
                if (!current()) throw new Error('Delivery address or customer session changed. Retry for the current address.');
                this.setCartFulfillmentLock(
                  String(cart.fulfillment_node_id || nodeId),
                  String(cart.fulfillment_node_name || ''),
                  String(cart.fulfillment_promise_id || ''),
                  String(cart.fulfillment_promise_expires_at || '')
                );
                return response;
              })
            );
        })
      );
  }

  private activeOrderRequest = 0;
  loadActiveOrder(): void {
    const request = ++this.activeOrderRequest;
    this.activeOrderError.set('');
    const sessionVersion = this.auth.sessionVersion;
    if (!this.auth.isLoggedIn()) {
      this.activeOrder.set(null);
      return;
    }
    this.customerApi
      .toObservable<any>(this.customerApi.client.orders.activeOrder())
      .subscribe({
        next: (response) => {
          if (request === this.activeOrderRequest && sessionVersion === this.auth.sessionVersion) {
            this.activeOrderError.set('');
            this.activeOrder.set(response?.active_order || null);
          }
        },
        error: () => {
          if (request === this.activeOrderRequest && sessionVersion === this.auth.sessionVersion)
            this.activeOrderError.set('Active order could not refresh.');
        },
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
    const cartIssue = this.cartCheckoutBlockReason();
    if (cartIssue) return throwError(() => new Error(cartIssue));
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

    if (this.checkoutSubmitting() || this.hasCheckoutRecovery())
      return throwError(
        () =>
          new Error(
            'Check the existing submission before starting another order.'
          )
      );
    payload['client_idempotency_key'] = crypto.randomUUID();
    const session = this.checkoutSession();
    this.checkoutSubmitting.set(true);
    this.checkoutStage.set('quote');
    const shownQuote = this.checkoutPriceBreakup();
    return this.getCheckoutPreview(
      selectedPayment,
      !!options.codUpiConfirmed,
      options.scheduledFor
    ).pipe(
      concatMap((preview) => {
        if (!this.isCheckoutSessionCurrent(session))
          return throwError(
            () =>
              new Error(
                'Your customer session changed. Sign in again before continuing.'
              )
          );
        const latest = preview.price_breakup;
        if (!latest)
          return throwError(
            () => new Error('Order charges could not be confirmed.')
          );
        if (
          shownQuote &&
          this.quoteSignature(shownQuote) !== this.quoteSignature(latest)
        ) {
          this.checkoutPriceBreakup.set(latest);
          return throwError(() => ({
            error: {
              code: 'quote_changed',
              error:
                'Your order charges changed. Review the updated quote before continuing.',
            },
          }));
        }
        this.checkoutPriceBreakup.set(latest);
        payload['client_price_breakup'] = latest;
        return this.submitCheckoutPayload(payload, session);
      }),
      catchError((error) => {
        if (this.isCheckoutSessionCurrent(session))
          this.lastCheckoutError.set(this.checkoutFailureMessage(error));
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.isCheckoutSessionCurrent(session))
          this.checkoutSubmitting.set(false);
      })
    );
  }

  private quoteSignature(quote: Record<string, any>): string {
    return [
      'item_subtotal',
      'coupon_discount',
      'delivery_fee',
      'platform_fee',
      'packaging_fee',
      'small_cart_fee',
      'tax_amount',
      'surge_fee',
      'final_payable',
    ]
      .map((key) => `${key}:${Number(quote[key] || 0).toFixed(2)}`)
      .join('|');
  }

  private submitCheckoutPayload(
    payload: Record<string, any>,
    session: CheckoutSession
  ): Observable<Order> {
    if (payload['payment_method'] === 'razorpay') {
      return this.placeRazorpayOrder(payload, session);
    }
    return this.finalizeCheckout(payload, session);
  }

  private placeRazorpayOrder(
    payload: Record<string, any>,
    session: CheckoutSession
  ): Observable<Order> {
    return new Observable<Order>((subscriber) => {
      this.checkoutStage.set('creating-session');
      const subscription = this.cartApi
        .initiateCheckoutPayment({
          delivery_address_id: String(payload['delivery_address_id']),
          coupon_code: payload['coupon_code'],
          confirm_far_delivery: payload['confirm_far_delivery'],
          scheduled_for: payload['scheduled_for'],
        })
        .subscribe({
          next: (payment) => {
            if (!this.isCheckoutSessionCurrent(session)) {
              subscriber.error(
                new Error(
                  'Your customer session changed. Sign in again before continuing.'
                )
              );
              return;
            }
            if (
              Number(payment.amount) !==
              Math.round(
                Number(payload['client_price_breakup'].final_payable) * 100
              )
            ) {
              subscriber.error({
                error: {
                  code: 'quote_changed',
                  error:
                    'Your total changed before payment. Review the current quote.',
                },
              });
              return;
            }
            this.checkoutStage.set('provider-loading');
            this.paymentAdapter
              .open(
                payment,
                'Order payment',
                undefined,
                (stage) =>
                  this.isCheckoutSessionCurrent(session) &&
                  this.checkoutStage.set(stage)
              )
              .then((proof) => {
                const finalPayload = {
                  ...payload,
                  payment_method: 'razorpay',
                  razorpay_order_id: payment.razorpay_order_id,
                  razorpay_payment_id: proof.razorpay_payment_id,
                  razorpay_signature: proof.razorpay_signature,
                };
                if (!this.isCheckoutSessionCurrent(session)) {
                  this.saveCheckoutRecovery(finalPayload, session.userId);
                  subscriber.error(
                    new Error(
                      'Sign back into the original customer account to check this payment and order.'
                    )
                  );
                  return;
                }
                this.finalizeCheckout(finalPayload, session).subscribe({
                  next: (order) => subscriber.next(order),
                  complete: () => subscriber.complete(),
                  error: (error) => subscriber.error(error),
                });
              })
              .catch((error) => {
                if (this.isCheckoutSessionCurrent(session))
                  this.checkoutStage.set(
                    error.code === 'provider_cancelled'
                      ? 'cancelled'
                      : error.code === 'provider_script_unavailable'
                      ? 'script-unavailable'
                      : 'failed'
                  );
                subscriber.error(error);
              });
          },
          error: (error) => {
            if (this.isCheckoutSessionCurrent(session))
              this.checkoutStage.set('failed');
            subscriber.error(error);
          },
        });
      return () => subscription.unsubscribe();
    });
  }

  private checkoutSession(): CheckoutSession {
    return {
      userId: this.auth.user()?.id || '',
      version: this.auth.sessionVersion,
    };
  }

  private isCheckoutSessionCurrent(session: CheckoutSession): boolean {
    return (
      this.auth.isLoggedIn() &&
      session.version === this.auth.sessionVersion &&
      session.userId === this.auth.user()?.id
    );
  }

  private recoveryKey(userId = this.auth.user()?.id || ''): string {
    return `nextou.customer.checkoutRecovery.${userId}`;
  }

  private saveCheckoutRecovery(
    payload: Record<string, any>,
    userId = this.auth.user()?.id || ''
  ): void {
    this.recoveryByCustomer.set(userId, payload);
    if (this.auth.isLoggedIn() && userId === this.auth.user()?.id) {
      this.recoveryPayload = payload;
      this.hasCheckoutRecovery.set(true);
    }
    try {
      sessionStorage.setItem(this.recoveryKey(userId), JSON.stringify(payload));
    } catch {
      /* Keep the paid submission in memory even if browser storage is unavailable. */
    }
  }

  private restoreCheckoutRecovery(): void {
    try {
      this.recoveryPayload =
        this.recoveryByCustomer.get(this.auth.user()?.id || '') ||
        JSON.parse(sessionStorage.getItem(this.recoveryKey()) || 'null');
      this.hasCheckoutRecovery.set(!!this.recoveryPayload);
      if (this.recoveryPayload) this.checkoutStage.set('unknown');
    } catch {
      this.recoveryPayload = null;
      this.hasCheckoutRecovery.set(false);
    }
  }

  private clearCheckoutRecovery(userId = this.auth.user()?.id || ''): void {
    this.recoveryByCustomer.delete(userId);
    try {
      sessionStorage.removeItem(this.recoveryKey(userId));
    } catch {
      /* In-memory recovery still clears after confirmed success. */
    }
    if (userId === this.auth.user()?.id) {
      this.recoveryPayload = null;
      this.hasCheckoutRecovery.set(false);
    }
  }

  private finalizeCheckout(
    payload: Record<string, any>,
    session = this.checkoutSession()
  ): Observable<Order> {
    if (!this.isCheckoutSessionCurrent(session))
      return throwError(
        () =>
          new Error(
            'Your customer session changed. Return to the original account to check the existing submission.'
          )
      );
    this.saveCheckoutRecovery(payload, session.userId);
    this.checkoutStage.set('finalizing');
    return this.cartApi.createOrder(payload).pipe(
      map((response) => {
        this.clearCheckoutRecovery(session.userId);
        if (!this.isCheckoutSessionCurrent(session))
          throw new Error(
            'Your order was saved for the original customer. Sign back into that account to view it.'
          );
        this.checkoutStage.set('success');
        return this.finishPlacedOrder(response);
      }),
      catchError((error) => {
        if (!this.isCheckoutSessionCurrent(session))
          return throwError(() => error);
        const paid = !!payload['razorpay_payment_id'];
        const uncertain = paid || !error?.status || error.status >= 500;
        if (uncertain) {
          this.checkoutStage.set('unknown');
          this.lastCheckoutError.set(
            'Your order submission has not been confirmed. Check the existing submission before starting another payment.'
          );
        } else {
          this.clearCheckoutRecovery();
          this.checkoutStage.set('failed');
        }
        return throwError(() => error);
      })
    );
  }

  recoverCheckout(): Observable<Order> {
    if (this.checkoutSubmitting() || !this.recoveryPayload)
      return throwError(
        () => new Error('No existing submission is available to check.')
      );
    const session = this.checkoutSession();
    this.checkoutSubmitting.set(true);
    // Retry the same authenticated, idempotent creation request, including the original proof.
    return this.finalizeCheckout(this.recoveryPayload, session).pipe(
      finalize(() => {
        if (this.isCheckoutSessionCurrent(session)) this.checkoutSubmitting.set(false);
      })
    );
  }

  private checkoutFailureMessage(error: any): string {
    return (
      error?.error?.error ||
      error?.error?.detail ||
      error?.body?.error ||
      error?.message ||
      'Could not confirm the order. Please retry.'
    );
  }

  private finishPlacedOrder(response: any): Order {
    const raw = Array.isArray(response) ? response[0] : response;
    this.checkoutSubmitting.set(false);
    this.interruptedCheckout = false;
    this.loadCart();
    this.loadActiveOrder();
    return this.mapOrder(raw);
  }

  private refreshDeliveryFeePreview(): void {
    const request = ++this.deliveryPreviewRequest;
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
        if (
          request !== this.deliveryPreviewRequest ||
          this.activeAddress()?.id !== address.id
        )
          return;
        this.deliveryFeePreview.set(preview);
        this.requiresFarDeliveryConfirmation.set(
          !!preview.requires_far_delivery_confirmation
        );
        this.deliveryFeePreviewReadyAddressId.set(address.id);
        this.refreshCheckoutPreview();
      },
      error: () => {
        if (request !== this.deliveryPreviewRequest) return;
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

  acceptCheckoutPreview(preview: any): void {
    ++this.checkoutPreviewRequest;
    this.checkoutPreviewLoading.set(false);
    this.checkoutPreviewError.set('');
    this.checkoutPreviewErrorCode.set('');
    this.checkoutPriceBreakup.set(preview?.price_breakup || null);
  }

  private refreshCheckoutPreview(): void {
    const request = ++this.checkoutPreviewRequest;
    const sessionVersion = this.auth.sessionVersion;
    this.checkoutPreviewError.set('');
    this.checkoutPreviewErrorCode.set('');
    this.checkoutPreviewLoading.set(false);
    this.checkoutPriceBreakup.set(null);
    const address = this.activeAddress();
    if (!this.auth.isLoggedIn() || !address?.id || !this.cart().length) {
      this.checkoutPriceBreakup.set(null);
      return;
    }
    if (this.deliveryFeePreviewReadyAddressId() !== address.id) {
      this.checkoutPriceBreakup.set(null);
      return;
    }
    this.checkoutPreviewLoading.set(true);
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
          if (request !== this.checkoutPreviewRequest || sessionVersion !== this.auth.sessionVersion) return;
          this.checkoutPreviewLoading.set(false);
          this.checkoutPriceBreakup.set(preview?.price_breakup || null);
          if(!preview?.price_breakup) this.checkoutPreviewError.set('The server did not return a complete fee breakdown. Try again.');
        },
        error: (error) => {
          if (request !== this.checkoutPreviewRequest || sessionVersion !== this.auth.sessionVersion) return;
          this.checkoutPreviewLoading.set(false);
          this.checkoutPreviewErrorCode.set(this.extractApiErrorCode(error?.body || error?.error || error));
        this.checkoutPreviewError.set(this.explainApiError(error, 'Delivery and fees could not be confirmed. Try again.'));
        },
      });
  }

  private priceBreakupAmount(key: string): number {
    return this.moneyValue(this.checkoutPriceBreakup()?.[key]);
  }

  proceedToCheckout(): boolean {
    if (!this.auth.isLoggedIn()) {
      this.interruptedCheckout = true;
      this.closeMiniCart();
      this.ui.openLogin();
      return false;
    }
    const reason = this.cartCheckoutBlockReason();
    if (reason) {
      this.showToast(reason, 'warning');
      return false;
    }
    this.interruptedCheckout = false;
    this.router.navigate(['/checkout']);
    return true;
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

  private resolveCartStore(): Record<string, any> | null {
    const first = this.cart()[0];
    if (!first) return null;
    const raw = (first.raw || {}) as Record<string, any>;
    const rawCartProduct = (first.rawCartItem as any)?.product || {};
    const productVendor =
      typeof rawCartProduct?.vendor === 'object' ? rawCartProduct.vendor : null;
    const rawVendor = typeof raw['vendor'] === 'object' ? raw['vendor'] : null;
    const loadedStore = first.storeId
      ? this.catalog.stores().find((store) => store.id === first.storeId)
      : null;
    return (
      rawVendor || raw['store'] || productVendor || loadedStore?.raw || null
    );
  }

  private cartStoreAvailabilityIssue(): string {
    const vendor = this.cartStore();
    if (!vendor) return '';
    const isOpen = (vendor?.['is_open_now'] ?? vendor?.['is_open']) !== false;
    const acceptingOrders = vendor?.['is_accepting_orders'] !== false;
    const storeName =
      vendor?.['store_name'] || this.cart()[0]?.storeName || 'Store';
    if (vendor?.['is_open'] !== false && !acceptingOrders)
      return `${storeName} is temporarily not accepting orders.`;
    if (!isOpen) {
      const first = this.cart()[0];
      return first
        ? this.storeClosedMessage(first)
        : `${storeName} is closed right now.`;
    }
    if (!acceptingOrders)
      return `${storeName} is temporarily not accepting orders.`;
    return '';
  }

  private moneyValue(value: unknown): number {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  private addToGuestCart(
    product: Product,
    quantity: number,
    complete?: (success: boolean) => void
  ): void {
    const incoming = this.guestCartItem(product, quantity);
    const current = this.cart();
    const currentNode = this.currentServiceabilityNode();
    const differentFulfillment =
      !!current.length &&
      !!this.cartFulfillmentNodeId() &&
      !!currentNode.id &&
      this.cartFulfillmentNodeId() !== currentNode.id;
    const differentStore = current.some(
      (item) =>
        (item.storeId || item.storeName) &&
        (incoming.storeId || incoming.storeName) &&
        (item.storeId || item.storeName) !==
          (incoming.storeId || incoming.storeName)
    );
    const addItem = (items: CartItem[]) => {
      if (currentNode.id) {
        const fulfillment = this.currentServiceabilityFulfillment();
        this.setCartFulfillmentLock(
          currentNode.id,
          currentNode.name,
          fulfillment.promiseId,
          fulfillment.expiresAt
        );
      }
      this.commitGuestCart(items);
      this.lastAddedProductId.set(incoming.id);
      if (this.shouldAutoOpenMiniCart()) this.openMiniCart();
      this.showToast(`${incoming.name} added to cart`);
      complete?.(true);
    };

    if (differentFulfillment) {
      const existingNode =
        this.cartFulfillmentNodeName() || 'your previous delivery area';
      const incomingNode = currentNode.name || 'this delivery area';
      this.ui
        .confirm({
          title: 'Replace basket?',
          message: `Your basket is locked to ${existingNode}. To shop from ${incomingNode}, replace basket?`,
          confirmText: 'Replace basket',
          cancelText: 'Keep basket',
          tone: 'warning',
        })
        .then((confirmed) => {
          if (confirmed) addItem([incoming]);
          else complete?.(false);
        });
      return;
    }

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
          else complete?.(false);
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
    const payload = this.readGuestCartPayload();
    this.setCartFulfillmentLock(
      payload?.fulfillment?.nodeId || '',
      payload?.fulfillment?.nodeName || '',
      payload?.fulfillment?.promiseId || '',
      payload?.fulfillment?.expiresAt || ''
    );
    this.commitGuestCart(this.readGuestCartItems(payload), false);
  }

  private commitGuestCart(items: CartItem[], persist = true): void {
    this.cart.set(items);
    this.cartLoaded.set(true);
    this.cartApi.setCartCount(items.length);
    this.coupon.set('');
    this.couponDiscount.set(0);
    if (!items.length) this.setCartFulfillmentLock('', '');
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

  private readGuestCartPayload(): Partial<GuestCartPayload> | null {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(
        window.localStorage.getItem(this.guestCartStorageKey) || 'null'
      ) as Partial<GuestCartPayload> | null;
    } catch {
      return null;
    }
  }

  private readGuestCartItems(
    existingPayload?: Partial<GuestCartPayload> | null
  ): CartItem[] {
    try {
      const payload = existingPayload ?? this.readGuestCartPayload();
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
      fulfillment: {
        nodeId: this.cartFulfillmentNodeId(),
        nodeName: this.cartFulfillmentNodeName(),
        promiseId: this.cartFulfillmentPromiseId(),
        expiresAt: this.cartFulfillmentPromiseExpiresAt(),
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
    if (this.guestMergeInFlight || !this.auth.isLoggedIn()) return;
    const sessionVersion = this.auth.sessionVersion;
    const isCurrentSession = () => this.auth.isLoggedIn() && sessionVersion === this.auth.sessionVersion;
    const payload = this.readGuestCartPayload();
    this.setCartFulfillmentLock(
      payload?.fulfillment?.nodeId || '',
      payload?.fulfillment?.nodeName || '',
      payload?.fulfillment?.promiseId || '',
      payload?.fulfillment?.expiresAt || ''
    );
    const items = this.readGuestCartItems(payload);
    if (!items.length) {
      this.guestMergeRemaining.set(0);
      done();
      return;
    }
    const acknowledged: CartItem[] = [];
    this.guestMergeInFlight = true;
    this.guestMergeError.set('');
    this.guestMergeRemaining.set(items.length);
    const finish = (message = '') => {
      if (!isCurrentSession()) return;
      this.guestMergeInFlight = false;
      this.guestMergeError.set(message);
      done();
    };
    const acknowledge = (item: CartItem, remaining: CartItem[]) => {
      if (!isCurrentSession()) return;
      acknowledged.push(item);
      // Persist each acknowledged addition immediately. A retry starts with unsynced items only.
      this.writeGuestCartItems(remaining);
      this.guestMergeRemaining.set(remaining.length);
      addNext(remaining);
    };
    const addNext = (remaining: CartItem[]) => {
      if (!isCurrentSession()) return;
      const item = remaining[0];
      if (!item) {
        finish();
        this.showToast('Guest basket synced to your account');
        return;
      }
      this.cartApi
        .addToCart(
          item.apiId || item.id,
          item.quantity,
          this.cartFulfillmentContext()
        )
        .subscribe({
          next: () => acknowledge(item, remaining.slice(1)),
          error: (error) => {
            if (!isCurrentSession()) return;
            const body = error?.body || error?.error || {};
            const code = body.code || body.error_code;
            if (
              code !== 'cart_store_conflict' &&
              code !== 'cart_fulfillment_conflict'
            ) {
              const message = `${this.explainApiError(error, 'Some items could not sync.')} ${remaining.length} guest item(s) remain saved for retry.`;
              finish(message);
              if (acknowledged.length) {
                this.ui.confirm({
                  title: remaining.length === 1 ? 'One item needs another try.' : 'Some items need another try.',
                  eyebrow: 'Basket synchronization',
                  message: 'The completed items are already in your account basket. The remaining guest items have not completed.',
                  syncRows: [
                    ...acknowledged.map((synced) => ({id: synced.id, label: `${synced.name}, quantity ${synced.quantity}`, status: 'Already synced', tone: 'green' as const})),
                    ...remaining.map((pending, index) => ({id: pending.id, label: `${pending.name}, quantity ${pending.quantity}`, status: index === 0 ? 'Retry needed' : 'Not yet synced', tone: index === 0 ? 'orange' as const : 'neutral' as const})),
                  ],
                  notice: 'Your merge progress is kept. Only the remaining guest items are retried; already-synced quantities are not added again.',
                  confirmText: 'Retry remaining items',
                  confirmIcon: 'refresh',
                  cancelText: 'Keep for later',
                }).then((retry) => { if (retry && isCurrentSession()) this.retryGuestMerge(); });
              }
              return;
            }
            this.cartApi.getCart().subscribe({
              next: (savedCart: ApiCart) => {
                if (!isCurrentSession()) return;
                const savedItems = (savedCart.items || []).map((savedItem) => this.mapCartItem(savedItem));
                this.ui.confirm({
                  title: 'Which basket should we keep?',
                  eyebrow: 'After sign-in / Basket sync',
                  message: 'Your saved account basket and guest basket cannot be merged automatically. Choose which basket to keep.',
                  basketChoices: [
                    {title: 'Saved account basket', store: savedItems[0]?.storeName || body.existing_store_name || 'Saved store', items: savedItems.map((savedItem) => `${savedItem.quantity} ${savedItem.name}`).join(' + '), subtotal: cartSubtotal(savedItems)},
                    {title: 'Guest basket', store: item.storeName || 'Your chosen store', items: remaining.map((guestItem) => `${guestItem.quantity} ${guestItem.name}`).join(' + '), subtotal: cartSubtotal(remaining)},
                  ],
                  notice: 'No items are silently replaced, and quantities are not replayed twice.',
                  noticeTone: 'purple',
                  confirmText: 'Use guest basket',
                  cancelText: 'Keep saved basket',
                }).then((confirmed) => {
                  if (!isCurrentSession()) return;
                  if (!confirmed) {
                    finish('Your saved basket is unchanged. Your guest items remain saved; retry when you are ready to choose.');
                    return;
                  }
                  this.cartApi.replaceCart(item.apiId || item.id, item.quantity, this.cartFulfillmentContext()).subscribe({
                    next: () => acknowledge(item, remaining.slice(1)),
                    error: (replaceError) => finish(this.explainApiError(replaceError, 'Could not replace the saved basket. Guest items are still saved.')),
                  });
                });
              },
              error: (snapshotError) => finish(this.explainApiError(snapshotError, 'Could not load the saved basket for comparison. Guest items are still saved.')),
            });
          },
        });
    };
    addNext(items);
  }

  private mapAddress(address: ApiAddress): Address {
    const mapped = normalizeSharedAddress(address as any) as Address;
    return { ...mapped, line: address.address_line1 || mapped.line };
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
    return {
      ...createAddressPayload(address as any),
      is_default: !!address.isDefault,
      latitude:
        address.latitude == null || String(address.latitude).trim() === ''
          ? null
          : Number(address.latitude),
      longitude:
        address.longitude == null || String(address.longitude).trim() === ''
          ? null
          : Number(address.longitude),
    };
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

  private explainCouponError(error: any): string {
    if (error?.status === 401) return 'Sign in again to apply this coupon.';

    const payload = error?.error || error;
    const message = readApiError(payload).trim();
    const code = this.extractApiErrorCode(payload);
    const lowerMessage = message.toLowerCase();
    const lowerCode = code.toLowerCase();

    if (lowerMessage.includes('otp') || lowerCode.includes('otp')) {
      return 'This coupon code is not valid.';
    }
    if (message) return message;
    if (lowerCode.includes('expired')) return 'This coupon has expired.';
    if (lowerCode.includes('minimum') || lowerCode.includes('min_order')) {
      return 'This coupon needs a higher cart value.';
    }
    if (lowerCode.includes('usage')) {
      return 'This coupon has reached its usage limit.';
    }
    if (lowerCode.includes('invalid') || lowerCode.includes('coupon')) {
      return 'This coupon code is not valid.';
    }
    return 'Coupon is not valid for this order.';
  }

  private extractApiErrorCode(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    const nested =
      record['error'] && typeof record['error'] === 'object'
        ? (record['error'] as Record<string, unknown>)
        : null;
    return String(
      record['code'] ||
        record['error_code'] ||
        nested?.['code'] ||
        nested?.['error_code'] ||
        ''
    ).trim();
  }

  private isStoreOpenForProduct(product: Product): boolean {
    const raw = (product?.raw || {}) as Record<string, any>;
    const loadedStore = product?.storeId
      ? this.catalog.stores().find((store) => store.id === product.storeId)
      : null;
    const vendor = raw['vendor'] || raw['store'] || loadedStore?.raw;
    if (!vendor) return true;
    return (
      (vendor?.is_open_now ?? vendor?.is_open) !== false &&
      vendor?.is_accepting_orders !== false
    );
  }

  private storeClosedMessage(product: Product): string {
    const raw = (product?.raw || {}) as Record<string, any>;
    const loadedStore = product?.storeId
      ? this.catalog.stores().find((store) => store.id === product.storeId)
      : null;
    const vendor = raw['vendor'] || raw['store'] || loadedStore?.raw || {};
    const storeName = vendor?.store_name || product.storeName || 'Store';
    if (vendor?.is_open !== false && vendor?.is_accepting_orders === false)
      return `${storeName} is temporarily not accepting orders.`;
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
