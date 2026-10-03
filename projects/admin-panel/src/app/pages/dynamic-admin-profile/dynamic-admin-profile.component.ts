import { ProfileContextComponent } from '../../shared/profile-context.component';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiService, AuthService, User } from '@shared/public-api';
import { DynamicProfilePageComponent } from '../../shared/dynamic-profile/dynamic-profile-page.component';
import { EntityProfileAdapterService } from '../../shared/dynamic-profile/entity-profile-adapter.service';
import { ProfileHeroAction } from '../../shared/dynamic-profile/dynamic-profile.models';

@Component({
  selector: 'app-dynamic-admin-profile',
  standalone: true,
  imports: [DynamicProfilePageComponent, ProfileContextComponent],
  templateUrl: './dynamic-admin-profile.component.html',
})
export class DynamicAdminProfileComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly adapter = inject(EntityProfileAdapterService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly error = signal('');
  ngOnInit() {
    this.refresh();
  }
  refresh() {
    this.error.set('');
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (user) => this.auth.updateUserData(user as User),
        error: () => this.error.set('Could not refresh your account details.'),
      });
  }

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
