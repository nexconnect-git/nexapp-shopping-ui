import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService, ApiService } from '@shared/public-api';

@Component({
  selector: 'app-referral',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './referral.component.html',
  styleUrl: './referral.component.scss'
})
export class ReferralComponent implements OnInit {
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  loading = signal(true);
  referralCode = signal('');
  totalReferrals = signal(0);
  bonusPerReferral = signal(0);
  referrals = signal<any[]>([]);
  copied = signal(false);

  applyCode = '';
  applying = signal(false);
  applyError = signal('');
  applySuccess = signal('');
  alreadyApplied = signal(false);

  ngOnInit() {
    this.api.getReferral().subscribe({
      next: (data) => {
        this.referralCode.set(data.code);
        this.totalReferrals.set(data.total_referrals);
        this.bonusPerReferral.set(data.bonus_per_referral);
        this.referrals.set(data.referrals || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  copyCode() {
    navigator.clipboard.writeText(this.referralCode()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => {});
  }

  shareCode() {
    const msg = `Use my NexConnect referral code ${this.referralCode()} to get started! Download & order from local vendors near you.`;
    if (navigator.share) {
      navigator.share({ title: 'NexConnect Referral', text: msg }).catch(() => {});
    } else {
      navigator.clipboard.writeText(msg).then(() => this.alerts.success('Referral message copied!')).catch(() => {});
    }
  }

  submitApply() {
    const code = this.applyCode.trim().toUpperCase();
    if (!code) return;
    this.applying.set(true);
    this.applyError.set('');
    this.applySuccess.set('');
    this.api.applyReferralCode(code).subscribe({
      next: (res) => {
        this.applying.set(false);
        this.applySuccess.set(res.message || 'Referral code applied!');
        this.alreadyApplied.set(true);
      },
      error: (err) => {
        this.applying.set(false);
        this.applyError.set(err.error?.error || 'Could not apply code.');
      },
    });
  }

  goBack() { window.history.back(); }
  pointsEarned() { return this.totalReferrals() * this.bonusPerReferral(); }
}
