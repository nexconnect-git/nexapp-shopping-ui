import { Injectable, signal } from '@angular/core';

export type AlertTone = 'success' | 'error' | 'info' | 'warning';

export interface AlertBannerConfig {
  id?: number;
  title?: string;
  message: string;
  tone: AlertTone;
  durationMs?: number;
}

export interface AlertModalConfig {
  title: string;
  message: string;
  tone?: AlertTone;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmOnly?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  readonly banners = signal<AlertBannerConfig[]>([]);
  readonly modal = signal<AlertModalConfig | null>(null);

  private nextId = 1;

  showBanner(config: AlertBannerConfig) {
    const banner = { ...config, id: this.nextId++ };
    this.banners.update((current) => [...current, banner]);
    const durationMs = config.durationMs ?? 4200;
    if (durationMs > 0) {
      setTimeout(() => this.dismissBanner(banner.id!), durationMs);
    }
  }

  success(message: string, title = 'Done') {
    this.showBanner({ message, title, tone: 'success' });
  }

  error(message: string, title = 'Something went wrong') {
    this.showBanner({ message, title, tone: 'error' });
  }

  info(message: string, title = 'Heads up') {
    this.showBanner({ message, title, tone: 'info' });
  }

  warning(message: string, title = 'Please review') {
    this.showBanner({ message, title, tone: 'warning' });
  }

  dismissBanner(id: number) {
    this.banners.update((current) => current.filter((banner) => banner.id !== id));
  }

  openModal(config: AlertModalConfig) {
    this.modal.set(config);
  }

  closeModal() {
    this.modal.set(null);
  }

  confirmModal() {
    const current = this.modal();
    this.modal.set(null);
    current?.onConfirm?.();
  }

  cancelModal() {
    const current = this.modal();
    this.modal.set(null);
    current?.onCancel?.();
  }
}
