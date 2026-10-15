import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { BasketSummaryComponent } from '../../components/basket-summary/basket-summary.component';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { checkoutPaymentMethodForBackend } from '@nexconnect/customer-checkout';
import { isCustomerAddressComplete } from '@nexconnect/customer-validation';
import { Address, PaymentMethod } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { OrderService } from '../../services/order.service';
import { CustomerCartApiService } from '../../services/customer-cart-api.service';
import { UiService } from '../../services/ui.service';
import { CustomerCurrencyPipe as AppCurrencyPipe } from '../../shared/customer-currency/customer-currency.pipe';
import { CurrencyService } from '@shared/lib/services/currency.service';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { AuthService } from '../../services/auth.service';
import { NxModalShellComponent } from '../../shared/ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';

interface AddressPreviewState {
  loading?: boolean;
  preview?: any;
  error?: string;
  details?: any;
  code?: string;
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbsComponent,
    CustomerIconComponent,
    RouterLink,
    CustomerPageHeaderComponent,
    BasketSummaryComponent,
    AppCurrencyPipe,
    CustomerLockedStateComponent,
    CustomerStateComponent,
    NxModalShellComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly activeAddressPreview = computed<AddressPreviewState | undefined>(() => this.addressPreviews()[this.state.activeAddress()?.id || '']);
  readonly activeAddressUnavailable = computed(() => {
    const preview = this.activeAddressPreview();
    return preview?.code === 'delivery_not_serviceable' || preview?.preview?.same_state === false || !!this.blockingDeliveryQuote(preview?.preview);
  });
  readonly serviceableAlternativeAddress = computed(() => this.state.addresses().find(address => address.id !== this.state.activeAddress()?.id && !this.addressDisabledReason(address)));
  mobileSection = signal<'address' | 'slot' | 'payment' | 'review'>('address');
  selectedAddress = signal('');
  readonly addressChangeLoading = signal(false);
  private addressSelectionRequest = 0;
  deliveryMode = signal<'now' | 'scheduled'>('now');
  scheduledDate = signal(this.defaultScheduleDate());
  selectedPayment = signal('');
  addressPreviews = signal<Record<string, AddressPreviewState>>({});
  maxScheduleDate = this.offsetDateValue(7);
  readonly steps = [
    { id: 'address', label: 'Address' },
    { id: 'slot', label: 'Delivery' },
    { id: 'payment', label: 'Payment' },
    { id: 'review', label: 'Review' },
  ] as const;
  readonly stepIndex = computed(() =>
    this.steps.findIndex((step) => step.id === this.mobileSection())
  );
  readonly stepTitle = computed(
    () =>
      [
        'Where should we deliver?',
        'Now or a little later?',
        'Choose how to pay.',
        'One last look.',
      ][this.stepIndex()]
  );
  readonly quoteLoading = signal(false);
  readonly quoteError = signal('');
  readonly quote = signal<any>(null);
  readonly inlineError = signal('');
  readonly codConfirmationOpen = signal(false);
  readonly codAcknowledged = signal(false);
  readonly paymentError = signal<'cancelled' | 'declined' | 'script' | ''>('');
  readonly recoveryDismissed = signal(false);
  readonly paymentProgress = computed(() => {
    if (!this.state.checkoutSubmitting()) return '';
    const stage = this.state.checkoutStage();
    if (stage === 'creating-session' || stage === 'provider-loading') return 'processing';
    if (stage === 'finalizing') return 'finalizing';
    return '';
  });
  readonly paymentErrorTitle = computed(() => ({cancelled:'Payment cancelled. Basket kept.',declined:'Payment did not go through.',script:'Secure checkout did not load.'})[this.paymentError() as 'cancelled' | 'declined' | 'script'] || '');
  readonly paymentErrorDescription = computed(() => this.paymentError() === 'cancelled' ? 'You closed the secure gateway. No successful payment is recorded by this checkout. Your basket stays.' : this.paymentError() === 'declined' ? 'The payment provider reported a failed payment. No paid order has been confirmed. Your basket stays.' : 'The gateway script could not load. This is separate from a declined payment. Your basket stays.');
  readonly slots = signal<any[]>([]);
  readonly slotsLoading = signal(false);
  readonly slotsError = signal('');
  readonly selectedSlot = signal('');
  readonly deliveryTiming = computed(() =>
    this.deliveryMode() === 'now'
      ? 'As soon as possible'
      : this.slots().find((slot) => slot.start === this.selectedSlot())
          ?.displayLabel || 'Choose delivery time'
  );
  readonly scheduleAvailable = computed(
    () =>
      this.state.cart().length > 0 &&
      this.state
        .cart()
        .every((item) => item.raw?.is_scheduled_delivery === true)
  );
  private quoteRequest = 0;
  private slotsRequest = 0;
  private addressRequest = 0;
  hasAddresses = computed(() => this.state.addresses().length > 0);
  hasPaymentMethods = computed(() => this.state.paymentMethods().length > 0);
  selectedPaymentId = computed(
    () =>
      this.selectedPayment() ||
      this.state.selectedPaymentMethod() ||
      this.state.paymentMethods()[0]?.id ||
      ''
  );
  selectedPaymentMeta = computed<PaymentMethod>(() => {
    const selected = this.selectedPaymentId();
    return (
      this.state.paymentMethods().find((method) => method.id === selected) ||
      this.state.paymentMethods()[0] || {
        id: '',
        label: 'Choose a payment method',
        description: '',
        icon: '',
        isDefault: false,
      }
    );
  });
  scheduledFor = computed(() => {
    if (this.deliveryMode() !== 'scheduled') return null;
    return this.selectedSlot() || null;
  });
  activeStoreAvailability = computed(() => {
    const vendor = this.state.cart()[0]?.raw?.vendor as any;
    if (!vendor)
      return {
        isOpen: true,
        message: '',
      };
    const isOpen = (vendor?.is_open_now ?? vendor?.is_open) !== false;
    const opening = vendor?.opening_time
      ? this.formatClock(vendor.opening_time)
      : '';
    const closing = vendor?.closing_time
      ? this.formatClock(vendor.closing_time)
      : '';
    const message =
      vendor?.availability_note ||
      (!isOpen && opening && closing
        ? `'${
            vendor?.store_name || 'Store'
          }' is closed right now. Open ${opening} - ${closing}.`
        : !isOpen
        ? `'${vendor?.store_name || 'Store'}' is closed right now.`
        : '');
    return {
      isOpen,
      message,
    };
  });
  canPlaceOrder = computed(() => {
    const activeAddress = this.state.activeAddress();
    const addressReady =
      !!activeAddress && !this.addressDisabledReason(activeAddress);
    return (
      !this.state.paymentMethodsLoading() &&
      !this.state.paymentMethodsError() &&
      !this.state.checkoutSubmitting() &&
      !this.addressChangeLoading() &&
      !this.state.hasCheckoutRecovery() &&
      !!this.quote()?.price_breakup &&
      !this.quoteLoading() &&
      !this.quoteError() &&
      !this.state.cartCheckoutBlockReason() &&
      this.hasPaymentMethods() &&
      this.activeStoreAvailability().isOpen &&
      !this.scheduleError() &&
      addressReady
    );
  });
  checkoutBlockingReason = computed(() => {
    const cartIssue = this.state.cartCheckoutBlockReason();
    if (cartIssue) return cartIssue;
    if (!this.hasAddresses()) return 'Add a delivery address to continue.';
    const activeAddress = this.state.activeAddress();
    if (!activeAddress) return 'Select a delivery address to continue.';
    const addressIssue = this.addressDisabledReason(activeAddress);
    if (addressIssue) return addressIssue;
    if (!this.activeStoreAvailability().isOpen) {
      return (
        this.activeStoreAvailability().message ||
        'This store is currently not accepting orders.'
      );
    }
    const scheduleIssue = this.scheduleError();
    if (scheduleIssue) return scheduleIssue;
    if (!this.hasPaymentMethods())
      return 'No payment methods are available for this order right now.';
    return '';
  });
  mobileStickyState = computed(() => {
    const section = this.mobileSection();
    if (section === 'address') {
      return {
        label: this.hasAddresses()
          ? 'Continue to delivery'
          : 'Add delivery address',
        disabled:
          this.hasAddresses() &&
          (this.addressChangeLoading() || !this.state.activeAddress() ||
            !!this.addressDisabledReason(this.state.activeAddress()!) ||
            this.state.checkoutPreviewLoading() || !!this.state.checkoutPreviewError() || !this.state.checkoutPriceBreakup()),
      };
    }
    if (section === 'slot') {
      const blocked =
        !this.activeStoreAvailability().isOpen || !!this.scheduleError();
      return {
        label: 'Continue to payment',
        disabled: blocked,
      };
    }
    if (section === 'payment') {
      const blocked = !this.selectedPaymentId() || !this.hasPaymentMethods();
      return {
        label: 'Review order',
        disabled: blocked,
      };
    }
    return {
      label: this.state.checkoutSubmitting()
        ? 'Placing order...'
        : `Place order - ${this.currency.format(this.state.total())}`,
      disabled: !this.canPlaceOrder(),
    };
  });
  scheduleError = computed(() => {
    if (this.deliveryMode() !== 'scheduled') return '';
    if (!this.scheduleAvailable())
      return 'Scheduled delivery is unavailable for this basket.';
    if (this.slotsLoading()) return 'Checking delivery times.';
    if (this.slotsError()) return this.slotsError();
    if (!this.selectedSlot()) return 'Choose an available delivery time.';
    if (
      !this.slots().some(
        (slot) => slot.start === this.selectedSlot() && slot.available === true
      )
    )
      return 'This delivery time is no longer available.';
    return '';
  });
  private previewKey = '';
  private customerSession = -1;

  constructor(
    public state: AppStateService,
    private orders: OrderService,
    private router: Router,
    private cartApi: CustomerCartApiService,
    private ui: UiService,
    private currency: CurrencyService,
    public auth: AuthService
  ) {
    effect(() => {
      this.selectedAddress.set(this.state.activeAddress()?.id || '');
    });
    effect(() => {
      this.auth.currentUser();
      if (this.customerSession !== this.auth.sessionVersion) {
        this.customerSession = this.auth.sessionVersion;
        this.codConfirmationOpen.set(false);
        this.codAcknowledged.set(false);
        this.paymentError.set('');
        this.recoveryDismissed.set(false);
        this.mobileSection.set('address');
        this.selectedPayment.set('');
        ++this.addressSelectionRequest;
        this.addressChangeLoading.set(false);
        this.previewKey = '';
      }
      if (!this.auth.isLoggedIn()) {
        ++this.addressRequest; ++this.quoteRequest; ++this.slotsRequest;
        this.addressPreviews.set({}); this.quote.set(null); this.previewKey='';
        return;
      }
      if (
        !this.state.hasCheckoutRecovery() &&
        this.state.cartLoaded() &&
        !this.state.itemCount()
      ) {
        this.state.showToast('Your cart is empty. Add items before checkout.');
        this.router.navigate(['/cart']);
        return;
      }
      const cartIssue = this.state.cartCheckoutBlockReason();
      if (
        !this.state.hasCheckoutRecovery() &&
        this.state.cartLoaded() &&
        this.state.itemCount() &&
        cartIssue &&
        !this.state.deliveryUnavailable()
      ) {
        this.state.showToast(cartIssue, 'warning');
        this.router.navigate(['/cart']);
        return;
      }
      const key = `${this.auth.currentUser() ? this.auth.sessionVersion : ''}::${this.state
        .cart()
        .map((item) => item.id + ':' + item.quantity)
        .join('|')}::${this.state
        .addresses()
        .map((address) => JSON.stringify(address))
        .join('|')}`;
      if (key === this.previewKey) return;
      this.previewKey = key;
      this.refreshAddressPreviews();
    });
    effect(() => {
      const selected = this.selectedPaymentId();
      if (!selected) return;
      if (selected !== this.state.selectedPaymentMethod()) {
        this.state.selectPayment(selected);
      }
    });
    effect(() => {
      this.state.activeAddress()?.id;
      this.selectedPaymentId();
      this.deliveryMode();
      this.selectedSlot();
      this.state.coupon();
      this.state
        .cart()
        .map((item) => item.id + ':' + item.quantity)
        .join('|');
      this.quote.set(null);
      this.quoteError.set('');
      ++this.quoteRequest;
      if (
        this.mobileSection() === 'review' &&
        !this.state.hasCheckoutRecovery()
      )
        this.refreshQuote();
    });
  }

  selectAddress(id: string, dropdown?: HTMLDetailsElement): void {
    const address = this.state.addresses().find((item) => item.id === id);
    if (!address) return;
    const reason = this.addressDisabledReason(address);
    if (reason) {
      this.selectedAddress.set(this.state.activeAddress()?.id || '');
      this.state.showToast(reason);
      return;
    }
    this.selectedAddress.set(id);
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const session = this.auth.sessionVersion;
    const currentAddress = this.state.activeAddress();
    const currentFee = currentAddress?.id
      ? this.previewFee(currentAddress.id)
      : this.state.deliveryFeeKnown() ? this.state.deliveryFee() : null;
    const nextFee = this.previewFee(id);
    if (
      currentAddress?.id &&
      currentAddress.id !== id &&
      (currentFee === null || nextFee === null || currentFee !== nextFee)
    ) {
      const request = ++this.addressSelectionRequest;
      this.addressChangeLoading.set(true);
      const preview = this.addressPreviews()[id]?.preview;
      this.cartApi.getCheckoutPreview({
        delivery_address_id: id,
        payment_method: checkoutPaymentMethodForBackend(this.selectedPaymentId()),
        coupon_code: this.state.coupon(),
        confirm_far_delivery: !!this.primaryDeliveryQuote(preview)?.requires_far_delivery_confirmation,
        cod_upi_confirmed: true,
        scheduled_for: this.scheduledFor(),
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (quote) => {
          if (request !== this.addressSelectionRequest || session !== this.auth.sessionVersion) return;
          this.addressChangeLoading.set(false);
          const fee = Number(quote?.price_breakup?.delivery_fee);
          const payable = Number(quote?.price_breakup?.final_payable);
          if (!Number.isFinite(fee) || !Number.isFinite(payable)) {
            this.selectedAddress.set(this.state.activeAddress()?.id || '');
            this.state.showToast('The updated order charges could not be confirmed. Retry this address.', 'error');
            return;
          }
          this.ui.confirm({
            title: 'Your delivery fee changed.',
            eyebrow: 'Review the current quote',
            message: 'The selected address has a different delivery fee. Confirm the updated charge before continuing.',
            rows: [
              { label: 'Previous delivery fee', value: currentFee ?? 'Not confirmed', currency: currentFee !== null },
              { label: 'New delivery fee', value: fee, currency: true },
              { label: 'New payable', value: payable, currency: true },
            ],
            notice: 'This change requires a new confirmed quote. An older address response must not overwrite the current one.',
            cancelText: 'Keep previous address',
            confirmText: 'Accept updated quote',
          }, trigger).then((confirmed) => {
            if (this.destroyRef.destroyed || request !== this.addressSelectionRequest || session !== this.auth.sessionVersion) return;
            if (confirmed) this.applyAddressSelection(id, dropdown);
            else this.selectedAddress.set(this.state.activeAddress()?.id || '');
          });
        },
        error: (error) => {
          if (request !== this.addressSelectionRequest || session !== this.auth.sessionVersion) return;
          this.addressChangeLoading.set(false);
          this.selectedAddress.set(this.state.activeAddress()?.id || '');
          this.state.showToast(this.checkoutErrorMessage(error), 'error');
        },
      });
      return;
    }
    this.applyAddressSelection(id, dropdown);
  }

  selectPayment(id: string): void {
    this.selectedPayment.set(id);
    this.state.selectPayment(id);
  }

  isActiveAddress(id: string): boolean {
    return this.state.activeAddress()?.id === id;
  }

  placeOrder(): void {
    if (!this.canPlaceOrder()) {
      this.inlineError.set(
        this.checkoutBlockingReason() ||
          this.quoteError() ||
          'Confirm a current quote before placing your order.'
      );
      return;
    }
    const cartIssue = this.state.cartCheckoutBlockReason();
    if (cartIssue) {
      this.state.showToast(cartIssue, 'warning');
      this.router.navigate(['/cart']);
      return;
    }
    const availability = this.activeStoreAvailability();
    if (!availability.isOpen) {
      this.state.showToast(
        availability.message || 'This store is closed right now.'
      );
      return;
    }
    if (this.scheduleError()) {
      this.state.showToast(this.scheduleError());
      return;
    }
    const selectedPayment =
      this.selectedPayment() || this.state.selectedPaymentMethod() || 'cod';
    if (selectedPayment === 'cod') {
      this.codAcknowledged.set(false);
      this.codConfirmationOpen.set(true);
      return;
    }
    this.submitOrder(selectedPayment, true);
  }

  confirmCodOrder(): void {
    if (!this.codAcknowledged() || !this.canPlaceOrder()) return;
    this.codConfirmationOpen.set(false);
    this.submitOrder('cod', true);
  }

  changePayment(): void {
    if (this.state.checkoutSubmitting()) return;
    this.codConfirmationOpen.set(false);
    this.paymentError.set('');
    this.mobileSection.set('payment');
  }

  private submitOrder(selectedPayment: string, codUpiConfirmed: boolean): void {
    const session = this.auth.sessionVersion;
    this.paymentError.set('');
    this.recoveryDismissed.set(false);
    this.orders
      .placeOrder(selectedPayment, {
        codUpiConfirmed,
        scheduledFor: this.scheduledFor(),
      })
      .subscribe({
        next: (order) => { if (!this.destroyRef.destroyed && session === this.auth.sessionVersion) this.router.navigate(['/order-confirmed', order.id]); },
        error: (error) => {
          if (this.destroyRef.destroyed || session !== this.auth.sessionVersion) return;
          this.applyCheckoutError(error);
          this.inlineError.set(this.checkoutErrorMessage(error));
          const code = error?.error?.code || error?.body?.code || error?.code;
          this.paymentError.set(code === 'provider_cancelled' ? 'cancelled' : code === 'provider_failed' ? 'declined' : code === 'provider_script_unavailable' ? 'script' : '');
          if (!this.state.hasCheckoutRecovery() && !this.paymentError() && code !== 'quote_changed') {
            ++this.quoteRequest;
            this.quote.set(null);
            this.quoteLoading.set(false);
            this.quoteError.set(this.checkoutErrorMessage(error));
          }
          if (code === 'delivery_not_serviceable')
            this.mobileSection.set('address');
          if (code === 'quote_changed') {
            this.quote.set(null);
            this.quoteLoading.set(true);
            this.state.loadCart(
              () => this.refreshQuote(),
              () => {
                this.quoteLoading.set(false);
                this.quoteError.set('Your basket could not refresh. Retry the delivery quote before continuing.');
              }
            );
          }
        },
      });
  }

  goAddresses(): void {
    this.router.navigate(['/addresses'], {
      queryParams: { add: '1', returnUrl: '/checkout' },
    });
  }

  openMobileSection(section: 'address' | 'slot' | 'payment' | 'review'): void {
    const index = this.steps.findIndex((step) => step.id === section);
    if (index > this.stepIndex() || this.state.checkoutSubmitting()) return;
    this.mobileSection.set(section);
    this.inlineError.set('');
  }

  goBasket(): void {
    this.router.navigate(['/cart']);
  }

  back(): void {
    if (this.stepIndex() > 0)
      this.openMobileSection(this.steps[this.stepIndex() - 1].id);
  }

  retryQuote(): void {
    this.inlineError.set('');
    const session = this.auth.sessionVersion;
    this.quoteLoading.set(true);
    this.quoteError.set('');
    this.state.refreshDeliveryAvailability().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { if (session === this.auth.sessionVersion) this.refreshQuote(); },
      error: (error) => {
        if (session !== this.auth.sessionVersion) return;
        this.quoteLoading.set(false);
        this.quoteError.set(this.checkoutErrorMessage(error));
      },
    });
  }

  refreshQuote(): void {
    const request = ++this.quoteRequest;
    const session = this.auth.sessionVersion;
    this.quoteLoading.set(true);
    this.quoteError.set('');
    this.quote.set(null);
    this.state
      .getCheckoutPreview(this.selectedPaymentId(), true, this.scheduledFor())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          if (request !== this.quoteRequest || session !== this.auth.sessionVersion) return;
          this.quoteLoading.set(false);
          if(!preview?.price_breakup){ this.quoteError.set('The server did not confirm a complete fee breakdown. Retry before continuing.'); return; }
          this.quote.set(preview);
          this.state.acceptCheckoutPreview(preview);
        },
        error: (error) => {
          if (request !== this.quoteRequest || session !== this.auth.sessionVersion) return;
          this.quoteLoading.set(false);
          this.quoteError.set(this.checkoutErrorMessage(error));
        },
      });
  }

  setDeliveryMode(mode: 'now' | 'scheduled'): void {
    this.deliveryMode.set(mode);
    this.inlineError.set('');
    if (mode === 'scheduled') this.loadSlots();
  }

  loadSlots(): void {
    const request = ++this.slotsRequest;
    const session = this.auth.sessionVersion;
    this.slotsLoading.set(true);
    this.slotsError.set('');
    this.selectedSlot.set('');
    this.cartApi
      .getAvailableSlots({ date: this.scheduledDate(), days: 1 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (request !== this.slotsRequest || session !== this.auth.sessionVersion) return;
          this.slots.set(
            (response.results || []).map((slot: any) => ({
              ...slot,
              windowLabel: new Date(slot.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit',hour12:false}) + ' – ' + new Date(slot.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}),
              dayLabel: new Date(slot.start).toLocaleDateString([], {day:'numeric',month:'short'}) + ' ' + new Date(slot.start).toLocaleTimeString([], {timeZoneName:'short'}).split(' ').slice(-1)[0],
              displayLabel:
                new Date(slot.start).toLocaleString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                }) +
                ' – ' +
                new Date(slot.end).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short',
                }),
            }))
          );
          this.slotsLoading.set(false);
        },
        error: (error) => {
          if (request !== this.slotsRequest || session !== this.auth.sessionVersion) return;
          this.slotsLoading.set(false);
          this.slotsError.set(this.checkoutErrorMessage(error));
        },
      });
  }

  retryAddressQuotes(): void {
    this.refreshAddressPreviews();
  }

  recover(): void {
    const session = this.auth.sessionVersion;
    this.state
      .recoverCheckout()
      .subscribe({
        next: (order) => { if (!this.destroyRef.destroyed && session === this.auth.sessionVersion) this.router.navigate(['/order-confirmed', order.id]); },
        error: (error) => { if (!this.destroyRef.destroyed && session === this.auth.sessionVersion) this.inlineError.set(this.checkoutErrorMessage(error)); },
      });
  }

  runMobileStickyAction(): void {
    if (this.mobileSection() === 'review') {
      if (this.canPlaceOrder()) this.placeOrder();
      else
        this.state.showToast(
          this.checkoutBlockingReason() || 'Please review checkout details.'
        );
      return;
    }
    if (this.mobileSection() === 'address') {
      if (this.mobileStickyState().disabled) return;
      if (!this.hasAddresses()) {
        this.goAddresses();
        return;
      }
      if (!this.state.activeAddress()) {
        this.state.showToast('Select a delivery address to continue.');
        return;
      }
      if (this.addressDisabledReason(this.state.activeAddress()!)) {
        this.state.showToast(
          this.addressDisabledReason(this.state.activeAddress()!)
        );
        return;
      }
      this.mobileSection.set('slot');
      return;
    }
    if (this.mobileSection() === 'slot') {
      if (this.mobileStickyState().disabled) return;
      if (!this.activeStoreAvailability().isOpen) {
        this.state.showToast(
          this.activeStoreAvailability().message || 'Store is currently closed.'
        );
        return;
      }
      if (this.scheduleError()) {
        this.state.showToast(this.scheduleError());
        return;
      }
      this.mobileSection.set('payment');
      return;
    }
    if (!this.selectedPaymentId() || !this.hasPaymentMethods()) {
      this.state.showToast('Select a payment method to continue.');
      return;
    }
    this.mobileSection.set('review');
  }

  addressDisabledReason(address: Address): string {
    if (!isCustomerAddressComplete(address as any))
      return 'Update this address before checkout. Required details are missing.';
    const state = this.addressPreviews()[address.id];
    if (state?.loading) return 'Checking this address and delivery charge.';
    if (state?.error) return state.error;
    if (!state?.preview) return 'Confirm a delivery quote for this address.';
    const preview = state?.preview;
    const blockingQuote = this.blockingDeliveryQuote(preview);
    if (blockingQuote)
      return (
        blockingQuote.serviceability_error ||
        'This address is outside the selected store delivery area.'
      );
    if (preview?.same_state === false)
      return 'This address is in a different state and cannot be used for this order.';
    return '';
  }

  addressMessage(address: Address): string {
    const reason = this.addressDisabledReason(address);
    if (reason) return reason;
    const preview = this.addressPreviews()[address.id]?.preview;
    const quote = this.primaryDeliveryQuote(preview);
    if (quote?.requires_far_delivery_confirmation)
      return 'Changing to this address may change delivery fee and ETA.';
    return 'Serviceable for this order';
  }

  previewFee(addressId: string): number | null {
    const preview = this.addressPreviews()[addressId]?.preview;
    const raw = preview?.total_delivery_fee ?? preview?.delivery_fee;
    if (raw === null || raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  private applyAddressSelection(
    id: string,
    dropdown?: HTMLDetailsElement
  ): void {
    this.selectedAddress.set(id);
    this.state.selectAddress(id);
    if (dropdown) dropdown.open = false;
  }

  defaultScheduleDate(): string {
    return this.offsetDateValue(0);
  }

  private offsetDateValue(days: number): string {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private formatClock(value: string): string {
    const [hours, minutes] = String(value || '00:00')
      .slice(0, 5)
      .split(':')
      .map((part) => Number(part));
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private blockingDeliveryQuote(preview: any): any | null {
    return (
      this.deliveryQuotes(preview).find(
        (quote) => quote?.is_serviceable === false
      ) || null
    );
  }

  private primaryDeliveryQuote(preview: any): any | null {
    const quotes = this.deliveryQuotes(preview);
    return (
      quotes.find((quote) => quote?.is_serviceable === false) ||
      quotes.find((quote) => quote?.requires_far_delivery_confirmation) ||
      quotes.find((quote) => quote?.is_far_delivery) ||
      quotes[0] ||
      null
    );
  }

  private deliveryQuotes(preview: any): any[] {
    if (!preview) return [];
    if (Array.isArray(preview.fees)) return preview.fees;
    if (Array.isArray(preview.delivery_quotes)) return preview.delivery_quotes;
    if (preview.vendor_id || preview.serviceability_error) return [preview];
    return [];
  }

  private previewErrorState(error: any): AddressPreviewState {
    const payload = error?.error || error?.body || {};
    return {
      error:
        payload.error ||
        payload.detail ||
        'This address cannot be used for this order.',
      details: payload.details || null,
      code: payload.code || '',
    };
  }

  private applyCheckoutError(error: any): void {
    const payload = error?.error || error?.body || {};
    const address = this.state.activeAddress();
    if (!address?.id || payload.code !== 'delivery_not_serviceable') return;
    this.addressPreviews.update((current) => ({
      ...current,
      [address.id]: {
        error:
          payload.error ||
          payload.detail ||
          'This address cannot be used for this order.',
        details: payload.details || null,
        code: payload.code,
      },
    }));
  }

  private checkoutErrorMessage(error: any): string {
    const payload = error?.error || error?.body || {};
    return (
      payload.error ||
      payload.detail ||
      error?.body?.error ||
      error?.body?.detail ||
      error?.message ||
      'Could not place order'
    );
  }

  private refreshAddressPreviews(): void {
    const request = ++this.addressRequest;
    const session = this.auth.sessionVersion;
    const addresses = this.state.addresses();
    if (!this.state.itemCount() || !addresses.length) {
      this.addressPreviews.set({});
      return;
    }
    for (const address of addresses) {
      if (!isCustomerAddressComplete(address as any)) {
        this.addressPreviews.update((current) => ({
          ...current,
          [address.id]: {
            error:
              'Update this address before checkout. Required details are missing.',
          },
        }));
        continue;
      }
      this.addressPreviews.update((current) => ({
        ...current,
        [address.id]: { loading: true },
      }));
      this.cartApi.getDeliveryFeePreview(address.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (preview) => {
          if (request !== this.addressRequest || session !== this.auth.sessionVersion) return;
          this.addressPreviews.update((current) => ({
            ...current,
            [address.id]: { preview },
          }));
        },
        error: (error) => {
          if (request !== this.addressRequest || session !== this.auth.sessionVersion) return;
          this.addressPreviews.update((current) => ({
            ...current,
            [address.id]: this.previewErrorState(error),
          }));
        },
      });
    }
  }
}
