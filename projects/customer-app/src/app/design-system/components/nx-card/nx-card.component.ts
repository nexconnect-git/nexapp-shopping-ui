import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardVariant = 'flat' | 'raised' | 'bordered' | 'ghost';

@Component({
  selector: 'nx-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="'nx-card nx-card--' + variant + (padding ? ' nx-card--padded' : '') + (hover ? ' nx-card--hover' : '')">
      <ng-content />
    </div>
  `,
  styleUrl: './nx-card.component.scss',
})
export class NxCardComponent {
  @Input() variant: CardVariant = 'raised';
  @Input() padding = true;
  @Input() hover = false;
}
