import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'fd-customer-page-header',
  standalone: true,
  templateUrl: './customer-page-header.component.html',
  styleUrl: './customer-page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPageHeaderComponent {
  @Input() eyebrow = '';
  @Input({ required: true }) title = '';
  @Input() description = '';
}
