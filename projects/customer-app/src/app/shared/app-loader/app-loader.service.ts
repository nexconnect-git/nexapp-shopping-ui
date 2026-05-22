import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppLoaderService {
  readonly loading = signal(true);
  readonly message = signal('Preparing your instant delivery experience');

  show(message = 'Loading...'): void {
    this.message.set(message);
    this.loading.set(true);
  }

  hide(): void {
    this.loading.set(false);
  }

  async withLoader<T>(task: Promise<T>, message = 'Loading...'): Promise<T> {
    this.show(message);
    try {
      return await task;
    } finally {
      this.hide();
    }
  }
}
