import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-alert-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="alert-stack">
      @for (banner of alerts.banners(); track banner.id) {
        <section class="alert-banner" [class]="banner.tone">
          <div class="alert-copy">
            @if (banner.title) {
              <strong>{{ banner.title }}</strong>
            }
            <p>{{ banner.message }}</p>
          </div>
          <button type="button" class="alert-close" (click)="alerts.dismissBanner(banner.id!)">
            <span class="material-icons-outlined">close</span>
          </button>
        </section>
      }
    </div>

    @if (alerts.modal(); as modal) {
      <div class="alert-modal-backdrop" (click)="modal.confirmOnly ? null : alerts.cancelModal()">
        <section class="alert-modal" [class]="modal.tone || 'info'" (click)="$event.stopPropagation()">
          <div class="alert-modal-badge">
            <span class="material-icons-outlined">
              {{ modal.tone === 'error' ? 'error' : modal.tone === 'warning' ? 'warning' : modal.tone === 'success' ? 'check_circle' : 'info' }}
            </span>
          </div>
          <h3>{{ modal.title }}</h3>
          <p>{{ modal.message }}</p>
          <div class="alert-modal-actions">
            @if (!modal.confirmOnly) {
              <button type="button" class="ghost" (click)="alerts.cancelModal()">{{ modal.cancelLabel || 'Cancel' }}</button>
            }
            <button type="button" class="solid" (click)="alerts.confirmModal()">{{ modal.confirmLabel || 'Okay' }}</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    .alert-stack {
      position: fixed;
      top: 88px;
      right: 20px;
      z-index: 1200;
      display: grid;
      gap: 12px;
      width: min(360px, calc(100vw - 24px));
    }
    .alert-banner {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 16px 18px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.55);
      box-shadow: 0 24px 60px rgba(39, 27, 17, 0.12);
      backdrop-filter: blur(20px);
      background: rgba(255, 248, 241, 0.94);
      color: #2f241c;
    }
    .alert-banner.success { border-color: rgba(22, 163, 74, 0.28); }
    .alert-banner.error { border-color: rgba(220, 38, 38, 0.24); }
    .alert-banner.info { border-color: rgba(59, 130, 246, 0.24); }
    .alert-banner.warning { border-color: rgba(245, 158, 11, 0.28); }
    .alert-copy { flex: 1; display: grid; gap: 4px; }
    .alert-copy strong { font-size: 0.98rem; font-weight: 700; }
    .alert-copy p { margin: 0; color: #6a5645; line-height: 1.45; }
    .alert-close {
      border: 0;
      background: transparent;
      color: #7d6652;
      cursor: pointer;
    }
    .alert-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1300;
      display: grid;
      place-items: center;
      background: rgba(30, 20, 10, 0.48);
      padding: 20px;
    }
    .alert-modal {
      width: min(520px, 100%);
      padding: 28px;
      border-radius: 28px;
      background: linear-gradient(180deg, #fffaf5 0%, #fff2e5 100%);
      box-shadow: 0 40px 90px rgba(29, 17, 8, 0.22);
      display: grid;
      gap: 16px;
      color: #2d221b;
    }
    .alert-modal-badge {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: rgba(255, 122, 42, 0.12);
      color: #f97316;
    }
    .alert-modal h3 { margin: 0; font-size: 1.45rem; }
    .alert-modal p { margin: 0; color: #6f5b4b; line-height: 1.55; white-space: pre-line; }
    .alert-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }
    .alert-modal-actions button {
      border-radius: 999px;
      padding: 12px 18px;
      font-weight: 700;
      cursor: pointer;
      border: 0;
    }
    .alert-modal-actions .ghost {
      background: rgba(255,255,255,0.7);
      color: #6a5645;
      border: 1px solid rgba(193, 166, 144, 0.4);
    }
    .alert-modal-actions .solid {
      background: linear-gradient(135deg, #ff8a3d 0%, #ef5c21 100%);
      color: white;
    }
    @media (max-width: 768px) {
      .alert-stack {
        left: 12px;
        right: 12px;
        top: 78px;
        width: auto;
      }
      .alert-modal {
        padding: 24px 20px;
        border-radius: 24px;
      }
      .alert-modal-actions {
        flex-direction: column-reverse;
      }
      .alert-modal-actions button {
        width: 100%;
      }
    }
  `],
})
export class AlertHostComponent {
  readonly alerts = inject(AlertService);
}
