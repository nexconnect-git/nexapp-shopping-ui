import { inject, Injectable } from '@angular/core';
import {
  AppStateService,
  ToastTone,
} from '../app-state.service';

@Injectable({ providedIn: 'root' })
export class CustomerUiStateService {
  private readonly state = inject(AppStateService);

  readonly toast = this.state.toast;
  readonly miniCartOpen = this.state.miniCartOpen;
  readonly lastAddedProductId = this.state.lastAddedProductId;

  openMiniCart(): void {
    this.state.openMiniCart();
  }

  closeMiniCart(): void {
    this.state.closeMiniCart();
  }

  showToast(message: string, tone?: ToastTone): void {
    this.state.showToast(message, tone);
  }
}
