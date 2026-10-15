import { Injectable, signal } from '@angular/core';

export type EditModalType = 'profile' | 'address' | 'payment' | null;
export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  tone: 'default' | 'warning' | 'danger';
  eyebrow?: string;
  notice?: string;
  footnote?: string;
  confirmIcon?: string;
  artIcon?: string;
  syncRows?: Array<{ id: string; label: string; status: string; tone: 'green' | 'orange' | 'neutral' }>;
  basketChoices?: Array<{ title: string; store: string; items: string; subtotal: number }>;
  noticeTone?: 'warning' | 'purple';
  basketComparison?: { count: number; subtotal: number };
  rows?: Array<{label: string; value: string | number; currency?: boolean}>;
  items?: Array<{id: string; name: string; image?: string; quantity: number; price: number; previousPrice?: number; previousQuantity?: number}>;
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
  overlayTrigger: HTMLElement | null = null;
  private captureFocus(): void {
    this.overlayTrigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }
  private confirmResolver: ((confirmed: boolean) => void) | null = null;

  openLogin(): void {
    this.captureFocus();
    this.loginSliderOpen.set(true);
    this.closeMenus();
  }
  closeLogin(): void {
    this.loginSliderOpen.set(false);
  }

  openMiniCart(): void {
    this.captureFocus();
    this.miniCartOpen.set(true);
    this.closeMenus();
  }
  closeMiniCart(): void {
    this.miniCartOpen.set(false);
  }
  toggleMiniCart(): void {
    if (!this.miniCartOpen()) this.captureFocus();
    this.miniCartOpen.update((value) => !value);
    this.closeMenus();
  }

  openFilter(): void {
    this.captureFocus();
    this.filterSliderOpen.set(true);
    this.closeMenus();
  }
  closeFilter(): void {
    this.filterSliderOpen.set(false);
  }

  openLocation(): void {
    this.captureFocus();
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
    this.captureFocus();
    const next = !this.mobileSidebarOpen();
    this.closeMenus();
    this.mobileSidebarOpen.set(next);
  }
  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  openEdit(type: EditModalType): void {
    this.captureFocus();
    this.editModal.set(type);
    this.closeMenus();
  }
  closeEdit(): void {
    this.editModal.set(null);
  }

  confirmDiscardDraft(): Promise<boolean> {
    return this.confirm({
      eyebrow: 'Unsaved changes',
      title: 'Leave these changes behind?',
      message: 'Your form has changes that have not been saved. Keep editing or discard only this unsaved local draft.',
      notice: 'Previously saved addresses or profile updates are not undone by discarding this draft.',
      noticeTone: 'purple',
      confirmText: 'Discard changes',
      cancelText: 'Keep editing',
      tone: 'danger',
    });
  }

  confirm(
    options: Partial<ConfirmDialogState> & { message: string },
    trigger?: HTMLElement | null
  ): Promise<boolean> {
    if (trigger?.isConnected) this.overlayTrigger = trigger;
    else this.captureFocus();
    this.resolveConfirm(false);
    this.closeMenus();
    this.confirmDialog.set({
      title: options.title || 'Please confirm',
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      tone: options.tone || 'default',
      eyebrow: options.eyebrow,
      notice: options.notice,
      footnote: options.footnote,
      confirmIcon: options.confirmIcon,
      artIcon: options.artIcon,
      basketComparison: options.basketComparison,
      basketChoices: options.basketChoices,
      syncRows: options.syncRows,
      noticeTone: options.noticeTone,
      rows: options.rows,
      items: options.items,
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
      (i) => (i - 1 + Math.max(length, 1)) % Math.max(length, 1)
    );
  }
}
