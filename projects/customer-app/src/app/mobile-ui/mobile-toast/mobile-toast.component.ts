import { Component, Input } from '@angular/core';
import { AppToast, ToastTone } from '../../services/app-state.service';

@Component({
  selector: 'fd-mobile-toast',
  standalone: true,
  templateUrl: './mobile-toast.component.html',
  styleUrls: ['./mobile-toast.component.scss'],
})
export class MobileToastComponent {
  @Input() toast: AppToast | null = null;

  toneIcon(tone: ToastTone | undefined): string {
    if (tone === 'success') return 'check_circle';
    if (tone === 'error') return 'error';
    if (tone === 'warning') return 'warning';
    return 'info';
  }
}
