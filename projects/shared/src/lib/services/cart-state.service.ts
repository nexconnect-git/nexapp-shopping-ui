import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartStateService {
  readonly cartCount = signal(0);
}
