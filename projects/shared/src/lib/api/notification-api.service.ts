import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-url.token';

@Injectable({ providedIn: 'root' })
export class NotificationApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getNotifications(): Observable<any> {
    return this.http.get(`${this.baseUrl}/notifications/list/`);
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/notifications/${id}/read/`, {});
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications/mark-all-read/`, {});
  }

  getUnreadCount(): Observable<any> {
    return this.http.get(`${this.baseUrl}/notifications/unread-count/`);
  }
}
