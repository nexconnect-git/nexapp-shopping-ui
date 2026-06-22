import { inject, Injectable } from '@angular/core';
import { AppStateService } from '../app-state.service';

@Injectable({ providedIn: 'root' })
export class CustomerOrderFacade {
  private readonly state = inject(AppStateService);

  readonly activeOrder = this.state.activeOrder;

  loadActiveOrder(): void {
    this.state.loadActiveOrder();
  }
}
