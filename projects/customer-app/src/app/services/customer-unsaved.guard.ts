import { CanDeactivateFn } from '@angular/router';

export interface CustomerUnsavedForm {
  canLeave(): boolean | Promise<boolean>;
}
export const customerUnsavedGuard: CanDeactivateFn<CustomerUnsavedForm> = (
  component
) => component.canLeave();
