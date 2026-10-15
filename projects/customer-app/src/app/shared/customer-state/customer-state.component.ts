import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'fd-customer-state',
  standalone: true,
  imports:[CustomerIconComponent],
  templateUrl: './customer-state.component.html',
  styleUrl: './customer-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerStateComponent {
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() action = '';
  @Input() icon = 'shopping_bag';
  @Input() artTone: 'default' | 'green' | 'orange' = 'default';
  @Input() tone: 'empty' | 'error' | 'warning' = 'empty';
  @Output() retry = new EventEmitter<void>();
}
