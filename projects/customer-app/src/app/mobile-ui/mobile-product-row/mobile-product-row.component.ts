import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AppCurrencyPipe } from '@shared/public-api';

@Component({
  selector: 'fd-mobile-product-row',
  standalone: true,
  imports: [AppCurrencyPipe],
  templateUrl: './mobile-product-row.component.html',
  styleUrls: ['./mobile-product-row.component.scss'],
})
export class MobileProductRowComponent {
  @Input() image = '';
  @Input() name = '';
  @Input() subtitle = '';
  @Input() price = 0;
  @Input() mrp?: number | null;
  @Input() buttonLabel = 'Add';
  @Output() pressed = new EventEmitter<void>();
  @Output() add = new EventEmitter<void>();
}

