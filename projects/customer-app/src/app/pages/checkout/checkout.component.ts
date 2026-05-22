import { Component, computed, effect, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  buildDeliveryFeeChangeConfirmation,
  COD_UPI_CONFIRMATION_MESSAGE,
  DEFAULT_UPI_APPS,
  defaultDeliverySlots,
  isUpiPaymentMethod,
  mergeBackendDeliverySlots,
  paymentIconFor,
  paymentPanelTitle,
} from '@nexconnect/customer-checkout';
import { isCustomerAddressComplete } from '@nexconnect/customer-validation';
import { Address } from '../../models';
import { AppStateService } from '../../services/app-state.service';
import { OrderService } from '../../services/order.service';
import { CustomerCartApiService } from '../../services/customer-cart-api.service';
import { OrderSummaryComponent } from '../../components/order-summary/order-summary.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { CurrencyService } from '@shared/public-api';

@Component({
  standalone: true,
  imports: [OrderSummaryComponent, ProductCardComponent, BreadcrumbsComponent],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent {
  step = signal(1);
  selectedAddress = signal('');
  selectedSlot = signal('10-15 mins');
  selectedPayment = signal('');
  addressPreviews = signal<
    Record<string, { loading?: boolean; preview?: any; error?: string }>
  >({});
  steps = [
    { id: 1, title: 'Address', sub: 'Choose delivery address' },
    { id: 2, title: 'Delivery', sub: 'Select delivery slot' },
    { id: 3, title: 'Payment', sub: 'Choose payment method' },
  ];
  slots = defaultDeliverySlots();
  readonly upiApps = [
    { name: 'Google Pay', logo: 'G', className: 'gpay' },
    { name: 'PhonePe', logo: 'पे', className: 'phonepe' },
    { name: 'Paytm', logo: 'Paytm', className: 'paytm' },
    { name: 'Amazon Pay', logo: 'a', className: 'amazonpay' },
    { name: 'BHIM', logo: 'BHIM', className: 'bhim' },
    { name: 'Other UPI', logo: 'UPI', className: 'upi' },
  ];
  readonly sharedUpiApps = DEFAULT_UPI_APPS;
  selectedPaymentMeta = computed(() => {
    const selected =
      this.selectedPayment() || this.state.selectedPaymentMethod();
    return (
      this.state.paymentMethods().find((method) => method.id === selected) ||
      this.state.paymentMethods()[0] ||
      null
    );
  });
  sameStoreSuggestions = computed(() => {
    const cart = this.state.cart();
    const storeId = cart[0]?.storeId;
    const cartIds = new Set(cart.map((item) => item.id));
    if (!storeId) return [];
    return this.catalog
      .products()
      .filter(
        (product) => product.storeId === storeId && !cartIds.has(product.id),
      )
      .slice(0, 4);
  });
  otherStoreSuggestions = computed(() => {
    const cart = this.state.cart();
    const storeId = cart[0]?.storeId;
    const cartIds = new Set(cart.map((item) => item.id));
    const categories = new Set(
      cart.map((item) => item.category).filter(Boolean),
    );
    if (!storeId || !categories.size) return [];
    return this.catalog
      .products()
      .filter(
        (product) =>
          product.storeId !== storeId &&
          categories.has(product.category) &&
          !cartIds.has(product.id),
      )
      .slice(0, 4);
  });

  private previewKey = '';

  constructor(
    public state: AppStateService,
    public catalog: CatalogService,
    private orders: OrderService,
    private router: Router,
    private cartApi: CustomerCartApiService,
    private ui: UiService,
    private currency: CurrencyService,
  ) {
    this.loadAvailableSlots();
    effect(() => {
      if (this.state.cartLoaded() && !this.state.itemCount()) {
        this.state.showToast('Your cart is empty. Add items before checkout.');
        this.router.navigate(['/cart']);
        return;
      }
      const key = `${this.state.itemCount()}::${this.state
        .addresses()
        .map((address) => address.id)
        .join('|')}`;
      if (key === this.previewKey) return;
      this.previewKey = key;
      this.refreshAddressPreviews();
    });
  }

  selectAddress(id: string): void {
    const address = this.state.addresses().find((item) => item.id === id);
    if (!address) return;
    const reason = this.addressDisabledReason(address);
    if (reason) {
      this.state.showToast(reason);
      return;
    }
    const currentAddress = this.state.activeAddress();
    const currentFee = currentAddress?.id
      ? this.previewFee(currentAddress.id)
      : this.state.deliveryFee();
    const nextFee = this.previewFee(id);
    if (
      currentAddress?.id &&
      currentAddress.id !== id &&
      currentFee !== nextFee
    ) {
      this.ui
        .confirm(
          buildDeliveryFeeChangeConfirmation({
            currentFee,
            nextFee,
            currentAddress,
            nextAddress: address,
          }),
        )
        .then((confirmed) => {
          if (confirmed) this.applyAddressSelection(id);
        });
      return;
    }
    this.applyAddressSelection(id);
  }

  selectPayment(id: string): void {
    this.selectedPayment.set(id);
    this.state.selectPayment(id);
  }

  isActiveAddress(id: string): boolean {
    return this.state.activeAddress()?.id === id;
  }

  isUpiPayment(id: string): boolean {
    return isUpiPaymentMethod(id);
  }

  paymentPanelTitle(id: string): string {
    return paymentPanelTitle(id);
  }

  paymentIcon(id: string): string {
    return paymentIconFor(id);
  }

  placeOrder(): void {
    const selectedPayment =
      this.selectedPayment() || this.state.selectedPaymentMethod();
    if (selectedPayment === 'cod') {
      this.ui
        .confirm({
          title: 'Confirm COD payment',
          message: COD_UPI_CONFIRMATION_MESSAGE,
          confirmText: 'I understand',
          cancelText: 'Cancel',
          tone: 'warning',
        })
        .then((confirmed) => {
          if (confirmed) this.submitOrder(selectedPayment, true);
        });
      return;
    }
    this.submitOrder(selectedPayment, true);
  }

  private submitOrder(selectedPayment: string, codUpiConfirmed: boolean): void {
    const selectedSlot = this.slots.find(
      (slot) => slot.name === this.selectedSlot(),
    );
    this.orders
      .placeOrder(selectedPayment, {
        codUpiConfirmed,
        scheduledFor: selectedSlot?.scheduledFor || null,
      })
      .subscribe({
        next: (order) => this.router.navigate(['/tracking', order.id]),
        error: (error) =>
          this.state.showToast(error?.message || 'Could not place order'),
      });
  }

  selectUpiApp(app: string): void {
    this.selectPayment('razorpay_upi');
    this.state.showToast(`${app} selected for payment`);
  }

  goAddresses(): void {
    this.router.navigate(['/addresses']);
  }

  continueFromAddress(): void {
    const active = this.state.activeAddress();
    if (!active) {
      this.state.showToast('Select a delivery address before continuing.');
      return;
    }
    const reason = this.addressDisabledReason(active);
    if (reason) {
      this.state.showToast(reason);
      return;
    }
    this.step.set(2);
  }

  addressDisabledReason(address: Address): string {
    if (!isCustomerAddressComplete(address as any))
      return 'Update this address before checkout. Required details are missing.';
    const state = this.addressPreviews()[address.id];
    if (state?.error) return state.error;
    const preview = state?.preview;
    if (preview?.is_serviceable === false)
      return (
        preview.serviceability_error ||
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
    if (preview?.requires_far_delivery_confirmation)
      return 'Changing to this address may change delivery fee and ETA.';
    const fee = this.previewFee(address.id);
    return fee > 0
      ? `Delivery fee ${this.currency.format(fee)}`
      : 'Serviceable for this order';
  }

  previewFee(addressId: string): number {
    const preview = this.addressPreviews()[addressId]?.preview;
    const raw = preview?.total_delivery_fee ?? preview?.delivery_fee ?? 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  private loadAvailableSlots(): void {
    this.cartApi.getAvailableSlots({ days: 7 }).subscribe({
      next: (response) => {
        const slots = Array.isArray(response?.results) ? response.results : [];
        if (!slots.length) return;
        this.slots = mergeBackendDeliverySlots(slots);
      },
      error: () => {},
    });
  }

  private buildDeliverySlots(): Array<{
    name: string;
    type: string;
    price: string;
    time?: string;
    scheduledFor?: string;
  }> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return [
      {
        name: 'Fastest available',
        type: 'Express Delivery',
        time: this.fastestWindowLabel(),
        price: 'Calculated live',
      },
      {
        name: 'Priority slot',
        type: 'Next available window',
        time: this.offsetWindowLabel(30, 60),
        price: 'Calculated live',
      },
      {
        name: 'Tomorrow',
        type: 'Scheduled delivery',
        time: '8 AM - 12 PM',
        price: 'Calculated live',
      },
      {
        name: 'Tomorrow afternoon',
        type: 'Scheduled delivery',
        time: '12 PM - 4 PM',
        price: 'Calculated live',
      },
      {
        name: dayAfter.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        type: 'Scheduled delivery',
        time: '9 AM - 1 PM',
        price: 'Calculated live',
      },
    ];
  }

  private applyAddressSelection(id: string): void {
    this.selectedAddress.set(id);
    this.state.selectAddress(id);
  }

  private addressTitle(address: Address | null | undefined): string {
    if (!address) return 'Current address';
    return [address.label, address.line, address.city, address.pincode]
      .filter(Boolean)
      .join(', ');
  }

  private fastestWindowLabel(): string {
    const start = new Date();
    const end = new Date(start.getTime() + 25 * 60000);
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  private offsetWindowLabel(startMinutes: number, endMinutes: number): string {
    const start = new Date(Date.now() + startMinutes * 60000);
    const end = new Date(Date.now() + endMinutes * 60000);
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  private slotTimeLabel(start?: string, end?: string): string {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    if (Number.isNaN(startDate.getTime())) return '';
    const startText = startDate.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const endText =
      endDate && !Number.isNaN(endDate.getTime())
        ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
    return endText ? `${startText} - ${endText}` : startText;
  }

  private refreshAddressPreviews(): void {
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
      this.cartApi.getDeliveryFeePreview(address.id).subscribe({
        next: (preview) =>
          this.addressPreviews.update((current) => ({
            ...current,
            [address.id]: { preview },
          })),
        error: (error) =>
          this.addressPreviews.update((current) => ({
            ...current,
            [address.id]: {
              error:
                error?.error?.error ||
                error?.error?.detail ||
                'This address cannot be used for this order.',
            },
          })),
      });
    }
  }
}
