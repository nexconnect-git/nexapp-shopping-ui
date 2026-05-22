import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@shared/public-api';
import { DynamicProfilePageComponent } from '../../shared/dynamic-profile/dynamic-profile-page.component';
import { EntityProfileAdapterService } from '../../shared/dynamic-profile/entity-profile-adapter.service';
import { ProfileHeroAction } from '../../shared/dynamic-profile/dynamic-profile.models';

@Component({
  selector: 'app-dynamic-admin-profile',
  standalone: true,
  imports: [DynamicProfilePageComponent],
  templateUrl: './dynamic-admin-profile.component.html',
})
export class DynamicAdminProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly adapter = inject(EntityProfileAdapterService);
  private readonly router = inject(Router);

  readonly profileConfig = computed(() => {
    const user = this.auth.user();
    return user ? this.adapter.buildProfileConfig('admin-user', user) : null;
  });

  handleAction(action: ProfileHeroAction): void {
    if (action.id === 'edit') this.router.navigate(['/admin/profile/edit']);
    if (action.id === 'review') this.router.navigate(['/admin/profile/review']);
  }

  editSection(stepId: string): void {
    this.router.navigate(['/admin/profile/edit'], {
      queryParams: { step: stepId },
    });
  }
}
