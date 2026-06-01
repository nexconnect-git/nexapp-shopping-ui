import { Component, Input } from '@angular/core';

type CheckoutStepKey = 'address' | 'slot' | 'payment' | 'review';

@Component({
  selector: 'fd-mobile-checkout-stepper',
  standalone: true,
  templateUrl: './mobile-checkout-stepper.component.html',
  styleUrls: ['./mobile-checkout-stepper.component.scss'],
})
export class MobileCheckoutStepperComponent {
  @Input() active: CheckoutStepKey = 'address';

  readonly steps: Array<{ key: CheckoutStepKey; label: string }> = [
    { key: 'address', label: 'Address' },
    { key: 'slot', label: 'Slot' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Review' },
  ];
}

