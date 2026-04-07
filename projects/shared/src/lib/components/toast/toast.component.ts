import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let t of toastService.toasts()" class="toast-item" [ngClass]="t.type">
        <div class="toast-content">
          <span class="material-icons-outlined icon_custom">
            <ng-container *ngIf="t.type === 'success'">check_circle</ng-container>
            <ng-container *ngIf="t.type === 'error'">error</ng-container>
            <ng-container *ngIf="t.type === 'info'">notifications</ng-container>
          </span>
          <p class="toast-msg">{{ t.message }}</p>
        </div>
        <div class="toast-actions">
          <button *ngIf="t.actionLabel && t.actionUrl" class="action-btn" (click)="performAction(t.actionUrl, t.id)">
            {{ t.actionLabel }}
          </button>
          <button class="close-btn" (click)="toastService.remove(t.id)">&times;</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
      font-family: 'Outfit', sans-serif;
    }
    .toast-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      background: #fff;
      border-left: 5px solid;
      animation: slideIn 0.3s ease forwards;
    }
    .toast-item.success { border-left-color: #10B981; }
    .toast-item.error   { border-left-color: #EF4444; }
    .toast-item.info    { border-left-color: #3B82F6; }
    .toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .icon_custom {
      font-size: 24px;
    }
    .success .icon_custom { color: #10B981; }
    .error .icon_custom   { color: #EF4444; }
    .info .icon_custom    { color: #3B82F6; }
    .toast-msg {
      margin: 0;
      color: #333;
      font-size: 14px;
      line-height: 1.4;
    }
    .toast-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .action-btn {
      background: #f3f4f6;
      border: none;
      color: #000;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      transition: background 0.2s;
    }
    .action-btn:hover { background: #e5e7eb; }
    .close-btn {
      background: none;
      border: none;
      color: #999;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
    }
    .close-btn:hover { color: #333; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
  router = inject(Router);

  performAction(url: string, id: number) {
    this.router.navigateByUrl(url);
    this.toastService.remove(id);
  }
}
