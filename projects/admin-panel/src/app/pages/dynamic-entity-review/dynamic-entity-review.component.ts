import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, AuthService, ToastService } from '@shared/public-api';
import { DynamicReviewPageComponent } from '../../shared/dynamic-profile/dynamic-review-page.component';
import { DynamicReviewConfig } from '../../shared/dynamic-profile/dynamic-profile.models';
import { EntityProfileAdapterService } from '../../shared/dynamic-profile/entity-profile-adapter.service';

@Component({
  selector: 'app-dynamic-entity-review',
  standalone: true,
  imports: [DynamicReviewPageComponent],
  templateUrl: './dynamic-entity-review.component.html',
})
export class DynamicEntityReviewComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly adapter = inject(EntityProfileAdapterService);

  readonly loading = signal(true);
  readonly entityDto = signal<unknown>(null);
  readonly entityType = signal('vendor');
  readonly entityId = signal('');

  readonly reviewConfig = computed<DynamicReviewConfig | null>(() => {
    const dto = this.entityDto();
    return dto ? this.adapter.buildReviewConfig(this.entityType(), dto) : null;
  });

  ngOnInit(): void {
    this.entityType.set(this.route.snapshot.data['entityType'] || 'vendor');
    this.entityId.set(this.route.snapshot.paramMap.get('id') || '');
    this.load();
  }

  back(): void {
    this.router.navigate([this.profileUrl()]);
  }

  editSection(stepId: string): void {
    this.router.navigate([this.editUrl()], { queryParams: { step: stepId } });
  }

  saveDraft(): void {
    this.toast.show('Draft saved.', 'success');
  }

  submitForApproval(): void {
    const type = this.entityType();
    const id = this.entityId();
    const request =
      type === 'vendor'
        ? this.api.setVendorStatus(id, 'approved')
        : type === 'delivery-partner'
          ? this.api.approveDeliveryPartner(id, 'approve')
          : null;

    if (!request) {
      this.toast.show('Review submitted.', 'success');
      this.router.navigate([this.profileUrl()]);
      return;
    }

    request.subscribe({
      next: () => {
        this.toast.show('Review submitted.', 'success');
        this.router.navigate([this.profileUrl()]);
      },
      error: () => this.toast.show('Unable to submit review.', 'error'),
    });
  }

  submitStatus(payload: { status: string; reason: string }): void {
    if (this.entityType() !== 'vendor') {
      this.submitForApproval();
      return;
    }
    this.api
      .setVendorStatus(this.entityId(), payload.status, payload.reason)
      .subscribe({
        next: (dto: unknown) => {
          this.entityDto.set(this.normalizeLoadedDto(dto));
          this.toast.show('Vendor status updated.', 'success');
          this.router.navigate([this.profileUrl()]);
        },
        error: () => this.toast.show('Unable to update vendor status.', 'error'),
      });
  }

  private load(): void {
    this.loading.set(true);
    const type = this.entityType();
    const id = this.entityId();
    const request =
      type === 'vendor'
        ? this.api.getAdminVendor(id)
        : type === 'customer'
          ? this.api.getAdminCustomer(id)
          : type === 'delivery-partner'
            ? this.api.getAdminDeliveryPartner(id)
            : type === 'product'
              ? this.api.getAdminProducts({ id })
              : this.api.getProfile();

    request.subscribe({
      next: (dto: unknown) => {
        this.entityDto.set(
          type === 'admin-user'
            ? this.auth.user() || dto
            : this.normalizeLoadedDto(dto),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Unable to load review data.', 'error');
      },
    });
  }

  private normalizeLoadedDto(dto: unknown): unknown {
    if (dto && typeof dto === 'object' && 'results' in dto) {
      const results = (dto as { results?: unknown[] }).results || [];
      return results[0] || dto;
    }
    return dto;
  }

  private profileUrl(): string {
    const type = this.entityType();
    if (type === 'vendor') return `/vendors/${this.entityId()}`;
    if (type === 'customer') return `/customers/${this.entityId()}`;
    if (type === 'delivery-partner')
      return `/delivery-partners/${this.entityId()}`;
    return '/admin/profile';
  }

  private editUrl(): string {
    const type = this.entityType();
    if (type === 'vendor') return `/vendors/${this.entityId()}/edit`;
    if (type === 'customer') return `/customers/${this.entityId()}/edit`;
    if (type === 'delivery-partner')
      return `/delivery-partners/${this.entityId()}/edit`;
    return '/admin/profile/edit';
  }
}
