import { Component, Input } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'nx-spinner',
  standalone: true,
  template: `<span [class]="'nx-spinner nx-spinner--' + size" role="status" aria-label="Loading"></span>`,
  styleUrl: './nx-spinner.component.scss',
})
export class NxSpinnerComponent {
  @Input() size: SpinnerSize = 'md';
}
