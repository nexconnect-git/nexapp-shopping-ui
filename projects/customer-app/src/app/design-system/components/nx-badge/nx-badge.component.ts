import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant =
  | 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
  | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up'
  | 'on_the_way' | 'delivered' | 'cancelled';

const STATUS_MAP: Record<string, BadgeVariant> = {
  pending:          'pending',
  confirmed:        'confirmed',
  preparing:        'preparing',
  ready_for_pickup: 'ready',
  picked_up:        'picked_up',
  on_the_way:       'on_the_way',
  delivered:        'delivered',
  cancelled:        'cancelled',
};

@Component({
  selector: 'nx-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="'nx-badge nx-badge--' + resolvedVariant">
      @if (dot) { <span class="nx-badge__dot"></span> }
      <ng-content />
    </span>
  `,
  styleUrl: './nx-badge.component.scss',
})
export class NxBadgeComponent {
  @Input() variant: BadgeVariant | string = 'default';
  @Input() dot = false;

  get resolvedVariant(): string {
    return STATUS_MAP[this.variant] ?? this.variant;
  }
}
