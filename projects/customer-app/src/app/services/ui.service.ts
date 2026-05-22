import { Injectable, signal } from '@angular/core';

export type EditModalType = 'profile' | 'address' | 'payment' | null;
export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  tone: 'default' | 'warning' | 'danger';
}

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly loginSliderOpen = signal(false);
  readonly miniCartOpen = signal(false);
  readonly filterSliderOpen = signal(false);
  readonly locationModalOpen = signal(false);
  readonly moreMenuOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly mobileSidebarOpen = signal(false);
  readonly editModal = signal<EditModalType>(null);
  readonly confirmDialog = signal<ConfirmDialogState | null>(null);
  readonly bannerIndex = signal(0);
  private confirmResolver: ((confirmed: boolean) => void) | null = null;

  openLogin(): void {
    this.loginSliderOpen.set(true);
    this.closeMenus();
  }
  closeLogin(): void {
    this.loginSliderOpen.set(false);
  }

  openMiniCart(): void {
    this.miniCartOpen.set(true);
    this.closeMenus();
  }
  closeMiniCart(): void {
    this.miniCartOpen.set(false);
  }
  toggleMiniCart(): void {
    this.miniCartOpen.update((value) => !value);
    this.closeMenus();
  }

  openFilter(): void {
    this.filterSliderOpen.set(true);
    this.closeMenus();
  }
  closeFilter(): void {
    this.filterSliderOpen.set(false);
  }

  openLocation(): void {
    this.locationModalOpen.set(true);
    this.closeMenus();
  }
  closeLocation(): void {
    this.locationModalOpen.set(false);
  }

  toggleMoreMenu(): void {
    this.moreMenuOpen.update((value) => !value);
    this.userMenuOpen.set(false);
  }
  toggleUserMenu(): void {
    this.userMenuOpen.update((value) => !value);
    this.moreMenuOpen.set(false);
  }
  closeMenus(): void {
    this.moreMenuOpen.set(false);
    this.userMenuOpen.set(false);
    this.mobileSidebarOpen.set(false);
  }
  toggleMobileSidebar(): void {
    this.closeMenus();
    this.mobileSidebarOpen.update((value) => !value);
  }
  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  openEdit(type: EditModalType): void {
    this.editModal.set(type);
    this.closeMenus();
  }
  closeEdit(): void {
    this.editModal.set(null);
  }

  confirm(
    options: Partial<ConfirmDialogState> & { message: string },
  ): Promise<boolean> {
    this.resolveConfirm(false);
    this.closeMenus();
    this.confirmDialog.set({
      title: options.title || 'Please confirm',
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      tone: options.tone || 'default',
    });
    return new Promise((resolve) => {
      this.confirmResolver = resolve;
    });
  }

  resolveConfirm(confirmed: boolean): void {
    if (this.confirmResolver) this.confirmResolver(confirmed);
    this.confirmResolver = null;
    this.confirmDialog.set(null);
  }

  nextBanner(length: number): void {
    this.bannerIndex.update((i) => (i + 1) % Math.max(length, 1));
  }
  prevBanner(length: number): void {
    this.bannerIndex.update(
      (i) => (i - 1 + Math.max(length, 1)) % Math.max(length, 1),
    );
  }
}
