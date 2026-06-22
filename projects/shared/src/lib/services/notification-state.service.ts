import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationStateService {
  readonly unreadNotifications = signal(0);
}
