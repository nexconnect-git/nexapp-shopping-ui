import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AppCurrencyPipe,
  VendorApi,
  VendorOperationsSummary,
} from '@shared/public-api';
import { VendorContextService } from '../../services/vendor-context.service';
import { OperatingStatusComponent } from '../../components/operating-status.component';
import { timer } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    OperatingStatusComponent,
    CommonModule,
    RouterLink,
    AppCurrencyPipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly store = inject(VendorContextService);
  private readonly api = inject(VendorApi);
  private readonly destroy = inject(DestroyRef);
  readonly ops = signal<VendorOperationsSummary | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  ngOnInit(): void {
    timer(0, 60000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (!document.hidden) this.refresh();
      });
  }
  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api
      .getVendorOperationsSummary()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.ops.set(result);
          this.error.set('');
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'Could not refresh today’s operations.')
          );
          this.loading.set(false);
        },
      });
  }
}
