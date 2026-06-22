import { inject, Injectable } from '@angular/core';
import { AppStateService } from '../app-state.service';
import { Product } from '../../models';

@Injectable({ providedIn: 'root' })
export class CustomerCartFacade {
  private readonly state = inject(AppStateService);

  readonly cart = this.state.cart;
  readonly cartLoaded = this.state.cartLoaded;
  readonly itemCount = this.state.itemCount;
  readonly subtotal = this.state.subtotal;
  readonly mrpTotal = this.state.mrpTotal;
  readonly discount = this.state.discount;
  readonly deliveryFee = this.state.deliveryFee;
  readonly total = this.state.total;

  addToCart(product: Product, quantity = 1): boolean {
    return this.state.addToCart(product, quantity);
  }

  updateQuantity(productId: string, delta: number): void {
    this.state.updateQuantity(productId, delta);
  }

  removeItem(productId: string): void {
    this.state.removeItem(productId);
  }

  clearCart(): void {
    this.state.clearCart();
  }

  applyCoupon(code: string): void {
    this.state.applyCoupon(code);
  }

  loadCart(): void {
    this.state.loadCart();
  }
}
