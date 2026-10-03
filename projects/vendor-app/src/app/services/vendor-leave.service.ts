import { AuthService } from '@shared/public-api';
import { inject, Injectable, signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
export interface VendorDirtyPage {
  hasUnsavedChanges(): boolean;
  isSaving?(): boolean;
}
@Injectable({ providedIn: 'root' })
export class VendorLeaveService {
  readonly open = signal(false);
  readonly saving = signal(false);
  private resolve?: (leave: boolean) => void;
  confirm(saving = false): Promise<boolean> {
    if (this.resolve) this.resolve(false);
    this.saving.set(saving);
    this.open.set(true);
    return new Promise((resolve) => (this.resolve = resolve));
  }
  answer(leave: boolean): void {
    this.open.set(false);
    this.resolve?.(leave);
    this.resolve = undefined;
  }
}
export const vendorDirtyGuard: CanDeactivateFn<VendorDirtyPage> = (
  component,
  current,
  state,
  next
) => {
  if (!inject(AuthService).isLoggedIn()) return true;
  if (state.url.split('?')[0] === next.url.split('?')[0]) return true;
  if (!component.hasUnsavedChanges() && !component.isSaving?.()) return true;
  return inject(VendorLeaveService).confirm(component.isSaving?.() || false);
};
