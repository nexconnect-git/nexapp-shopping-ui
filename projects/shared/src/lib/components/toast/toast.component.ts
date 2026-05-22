import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  toastService = inject(ToastService);
  router = inject(Router);

  performAction(url: string, id: number) {
    this.router.navigateByUrl(url);
    this.toastService.remove(id);
  }
}
