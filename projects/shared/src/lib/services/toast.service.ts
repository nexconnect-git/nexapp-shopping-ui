import { Injectable, signal } from '@angular/core';

export interface ToastConfig {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  actionLabel?: string;
  actionUrl?: string; // Route path if it's actionable
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<ToastConfig[]>([]);
  private nextId = 1;

  show(
    message: unknown,
    type: 'success' | 'error' | 'info' = 'info',
    actionLabel?: string,
    actionUrl?: string,
    duration = 5000,
  ) {
    const toastMessage = this.normalizeMessage(message);
    if (!toastMessage) return;
    const t: ToastConfig = {
      id: this.nextId++,
      message: toastMessage,
      type,
      actionLabel,
      actionUrl,
      duration,
    };
    this.toasts.update((ts) => [...ts, t]);
    if (duration > 0) {
      setTimeout(() => this.remove(t.id), duration);
    }
  }

  remove(id: number) {
    this.toasts.update((ts) => ts.filter((t) => t.id !== id));
  }

  private normalizeMessage(message: unknown): string {
    if (typeof message === 'boolean') return message ? 'Done' : '';
    if (message == null) return '';
    if (typeof message === 'object') {
      const record = message as Record<string, unknown>;
      const text =
        record['message'] ||
        record['detail'] ||
        record['error'] ||
        record['description'] ||
        '';
      return this.normalizeMessage(text);
    }
    const text = String(message).trim();
    if (text === 'true') return 'Done';
    if (text === 'false') return '';
    return text;
  }
}
