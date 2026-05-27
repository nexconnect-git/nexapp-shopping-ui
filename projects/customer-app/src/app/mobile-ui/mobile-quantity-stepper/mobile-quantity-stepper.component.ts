import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-mobile-quantity-stepper',
  standalone: true,
  templateUrl: './mobile-quantity-stepper.component.html',
  styleUrls: ['./mobile-quantity-stepper.component.scss'],
})
export class MobileQuantityStepperComponent {
  @Input() quantity = 0;
  @Output() decrement = new EventEmitter<void>();
  @Output() increment = new EventEmitter<void>();
}
