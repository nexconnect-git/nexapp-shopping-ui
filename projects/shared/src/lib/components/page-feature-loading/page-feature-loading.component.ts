import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageFeatureAccessService } from '../../services/page-feature-access.service';

@Component({
  selector: 'app-page-feature-loading',
  standalone: true,
  templateUrl: './page-feature-loading.component.html',
  styleUrl: './page-feature-loading.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageFeatureLoadingComponent {
  protected readonly features = inject(PageFeatureAccessService);
}
