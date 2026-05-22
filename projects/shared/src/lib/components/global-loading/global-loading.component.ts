import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GlobalLoadingService } from '../../services/global-loading.service';

@Component({
  selector: 'app-global-loading',
  standalone: true,
  templateUrl: './global-loading.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalLoadingComponent {
  protected readonly loading = inject(GlobalLoadingService);
}
