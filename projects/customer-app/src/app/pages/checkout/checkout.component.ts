import { Component, computed, effect, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  buildDeliveryFeeChangeConfirmation,
  COD_UPI_CONFIRMATION_MESSAGE,
  DEFAULT_UPI_APPS,
  isUpiPaymentMethod,
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
import { CatalogService } from '../../services/catalog.service';
import { UiService } from '../../services/ui.service';
import { AppCurrencyPipe, CurrencyService } from '@shared/public-api';
import { MobileStepperComponent } from '../../mobile-ui/mobile-stepper/mobile-stepper.component';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BreadcrumbsComponent,
    OrderSummaryComponent,
    ProductCardComponent,
    AppCurrencyPipe,
    MobileStepperComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent {
  step = signal(1);
  selectedAddress = signal('');
  deliveryMode = signal<'now' | 'scheduled'>('now');
  scheduledDate = signal(this.defaultScheduleDate());
  scheduledTime = signal(this.defaultScheduleTime());
  selectedPayment = signal('');
  selectedSlot = signal('Express');
  addressPreviews = signal<
    Record<string, { loading?: boolean; preview?: any; error?: string }>
  >({});
  steps = [
    { id: 1, title: 'Address', sub: 'Choose delivery address' },
    { id: 2, title: 'Delivery', sub: 'Schedule delivery' },
    { id: 3, title: 'Payment', sub: 'Choose payment method' },
  ];
  maxScheduleDate = this.offsetDateValue(7);
  slots = [
    {
      name: 'Express',
      type: 'ASAP delivery',
      time: 'ASAP delivery',
      fee: 'Current delivery fee',
      price: 'Current fee',
    },
    {
      name: 'Scheduled',
      type: 'Pick a slot',
      time: 'Pick a slot',
      fee: 'Based on store hours',
      price: 'Store hours',
    },
  ];
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
  vendorSchedule = computed(() => {
    const vendor = this.state.cart()[0]?.raw?.vendor as any;
    return {
      name: vendor?.store_name || this.state.cart()[0]?.storeName || 'Store',
      opening: vendor?.opening_time || '',
      closing: vendor?.closing_time || '',
      buffer: Number(vendor?.scheduled_buffer_min || vendor?.base_prep_time_min || 30),
    };
  });
  scheduledFor = computed(() => {
    if (this.deliveryMode() !== 'scheduled') return null;
    const date = this.scheduledDate();
    const time = this.scheduledTime();
    if (!date || !time) return null;
    const value = new Date(`${date}T${time}:00`);
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  });
  scheduleError = computed(() => {
    if (this.deliveryMode() !== 'scheduled') return '';
    const date = this.scheduledDate();
    const time = this.scheduledTime();
    if (!date || !time) return 'Select a delivery date and time.';
    const selected = new Date(`${date}T${time}:00`);
    if (Number.isNaN(selected.getTime())) return 'Select a valid delivery time.';
    const min = new Date(Date.now() + this.vendorSchedule().buffer * 60000);
    if (selected <= min)
      return `Pick a time at least ${this.vendorSchedule().buffer} minutes from now.`;
    const { opening, closing } = this.vendorSchedule();
    if (opening && closing) {
      const selectedTime = this.timeToMinutes(time);
      if (
        selectedTime < this.timeToMinutes(opening) ||
        selectedTime > this.timeToMinutes(closing)
      ) {
        return `Pick a time between ${this.formatClock(opening)} and ${this.formatClock(closing)}.`;
      }
    }
    return '';
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

  selectAddress(id: string, dropdown?: HTMLDetailsElement): void {
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
          if (confirmed) this.applyAddressSelection(id, dropdown);
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
    if (this.scheduleError()) {
      this.state.showToast(this.scheduleError());
      return;
    }
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
    this.orders
      .placeOrder(selectedPayment, {
        codUpiConfirmed,
        scheduledFor: this.scheduledFor(),
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

  continueFromDelivery(): void {
    if (this.scheduleError()) {
      this.state.showToast(this.scheduleError());
      return;
    }
    this.step.set(3);
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

  private applyAddressSelection(id: string, dropdown?: HTMLDetailsElement): void {
    this.selectedAddress.set(id);
    this.state.selectAddress(id);
    if (dropdown) dropdown.open = false;
  }

  private addressTitle(address: Address | null | undefined): string {
    if (!address) return 'Current address';
    return [address.label, address.line, address.city, address.pincode]
      .filter(Boolean)
      .join(', ');
  }

  defaultScheduleDate(): string {
    return this.offsetDateValue(0);
  }

  private defaultScheduleTime(): string {
    const value = new Date(Date.now() + 60 * 60000);
    value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
    return value.toTimeString().slice(0, 5);
  }

  private offsetDateValue(days: number): string {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return value.toISOString().slice(0, 10);
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = String(value || '00:00')
      .slice(0, 5)
      .split(':')
      .map((part) => Number(part));
    return hours * 60 + minutes;
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
