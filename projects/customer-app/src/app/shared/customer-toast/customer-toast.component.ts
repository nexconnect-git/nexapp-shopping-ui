import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '@shared/lib/services/toast.service';
import { CustomerIconComponent } from '../customer-icon/customer-icon.component';

@Component({
  selector: 'fd-customer-toast',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './customer-toast.component.html',
  styleUrl: './customer-toast.component.scss',
})
export class CustomerToastComponent {
  readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  performAction(url: string, id: number): void {
    void this.router.navigateByUrl(url);
    this.toastService.remove(id);
  }
}
