import { Component, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type BtnSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'button[nx-btn], a[nx-btn]',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loading) {
      <span class="nx-btn-spinner"></span>
    }
    <ng-content />
  `,
  styleUrl: './nx-button.component.scss',
})
export class NxButtonComponent {
  @Input() variant: BtnVariant = 'primary';
  @Input() size: BtnSize = 'md';
  @Input() loading = false;
  @Input() full = false;

  @HostBinding('class') get classes() {
    return [
      'nx-btn',
      `nx-btn--${this.variant}`,
      `nx-btn--${this.size}`,
      this.full ? 'nx-btn--full' : '',
      this.loading ? 'nx-btn--loading' : '',
    ].filter(Boolean).join(' ');
  }

  @HostBinding('attr.disabled') get isDisabled() {
    return this.loading ? true : null;
  }
}
