import { Component, computed, signal } from '@angular/core';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
import { AppStateService } from '../../services/app-state.service';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  standalone: true,
  imports: [AppCurrencyPipe],
  templateUrl: './referral.component.html',
  styleUrls: ['./referral.component.scss'],
})
export class ReferralComponent {
  code = signal('');
  referral = signal<any>(null);
  rewardAmount = computed(() =>
    Number(
      this.referral()?.total_earned ||
        this.referral()?.reward_balance ||
        this.referral()?.rewards ||
        0,
    ),
  );

  constructor(
    private api: ApiService,
    private state: AppStateService,
    public content: CustomerContentConfigService,
  ) {
    this.api.getReferral().subscribe({
      next: (response) => {
        this.referral.set(response);
        this.code.set(response.code || response.referral_code || '');
      },
      error: () => {},
    });
  }

  copy(): void {
    if (!this.code()) {
      this.state.showToast(this.content.referral().unavailableCode);
      return;
    }
    navigator.clipboard?.writeText(this.code());
    this.state.showToast(this.content.referral().copiedMessage);
  }

  share(channel: string): void {
    if (!this.code()) {
      this.state.showToast(this.content.referral().unavailableCode);
      return;
    }
    const message = `Use my Nextou referral code ${this.code()}`;
    if (channel === 'Share' && navigator.share) {
      navigator
        .share({ title: 'Nextou referral', text: message })
        .catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(message);
    this.state.showToast(`${channel} invite copied`);
  }
}
