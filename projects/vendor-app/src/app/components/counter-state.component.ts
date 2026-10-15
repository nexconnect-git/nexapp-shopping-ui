import { Component, input, output } from '@angular/core';
@Component({ selector: 'nc-counter-state', standalone: true, templateUrl: './counter-state.component.html', styleUrl: './counter-state.component.scss' })
export class CounterStateComponent {
  readonly kind = input<'loading' | 'empty' | 'error' | 'forbidden' | 'stale'>('empty');
  readonly title = input('Nothing here yet.');
  readonly message = input('');
  readonly action = input('');
  readonly rows = input(3);
  readonly retry = output<void>();
}
