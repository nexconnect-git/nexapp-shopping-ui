import {
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  VendorReview,
  VendorReviewPage,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { VendorContextService } from '../../services/vendor-context.service';
import { vendorListState } from '../../services/vendor-list-state';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, WorkspacePagerComponent],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss',
})
export class ReviewsComponent implements OnInit {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly context = inject(VendorContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly list = vendorListState<VendorReview, VendorReviewPage>((query) =>
    this.api.reviews(this.context.context()!.vendor.id, query)
  );
  readonly filter = signal('all');
  readonly stars = [5, 4, 3, 2, 1];
  private initialized = false;
  constructor() {
    effect(() => {
      if (this.context.context()?.vendor.id && this.initialized) this.load();
    });
  }
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.list.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.filter.set(params.get('filter') || 'all');
        this.initialized = true;
        this.load();
      });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        filter: this.filter() === 'all' ? null : this.filter(),
      },
    });
  }
  setFilter(value: string): void {
    this.filter.set(value);
    this.query();
  }
  load(): void {
    if (this.context.context()) this.list.load({ filter: this.filter() });
  }
}
