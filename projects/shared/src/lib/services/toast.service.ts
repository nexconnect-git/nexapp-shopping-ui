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

  show(message: string, type: 'success' | 'error' | 'info' = 'info', actionLabel?: string, actionUrl?: string, duration = 5000) {
    const t: ToastConfig = { id: this.nextId++, message, type, actionLabel, actionUrl, duration };
    this.toasts.update(ts => [...ts, t]);
    if (duration > 0) {
      setTimeout(() => this.remove(t.id), duration);
    }
  }

  remove(id: number) {
    this.toasts.update(ts => ts.filter(t => t.id !== id));
  }
}
