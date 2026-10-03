import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand, reduce } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ApiService, ToastService } from '@shared/public-api';
import { AdminAccessService } from '../../services/admin-access.service';
@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DialogModule],
  templateUrl: './permissions.component.html',
  styles: ['.admin-toolbar > label {display:grid;gap:8px;min-width:0;margin:0;} .admin-toolbar > label select {width:100%;} .admin-muted {overflow-wrap:anywhere;}'],
})
export class PermissionsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  access = inject(AdminAccessService);
  users = signal<any[]>([]);
  grants = signal<any[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  saving = signal(false);
  page = 0;
  userFilter = '';
  grantOpen = false;
  selectedUser = '';
  selectedPermission = '';
  pendingRevoke: any = null;
  ngOnInit() {
    this.access.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.loadUsers();
    this.load();
  }
  private loadUsers() {
    let page = 1;
    this.api
      .getAdminUsers({ page })
      .pipe(
        expand((response) =>
          response.next ? this.api.getAdminUsers({ page: ++page }) : EMPTY
        ),
        reduce(
          (users, response) => [...users, ...(response.results || response)],
          [] as any[]
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (users) => this.users.set(users),
        error: () => this.error.set('Could not load administrators.'),
      });
  }
  label(key: string) {
    return (
      this.access.identity()?.catalog.find((item) => item.key === key)?.label ||
      key
    );
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getAdminPermissionGrants({
        page: this.page + 1,
        ...(this.userFilter ? { user: this.userFilter } : {}),
      })
      .subscribe({
        next: (response) => {
          this.grants.set(response.results);
          this.total.set(response.count);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load permission grants.');
          this.loading.set(false);
        },
      });
  }
  openGrant() {
    this.selectedUser = '';
    this.selectedPermission = '';
    this.grantOpen = true;
  }
  grant() {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .createAdminPermissionGrant(this.selectedUser, this.selectedPermission)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.grantOpen = false;
          this.toast.show('Permission granted.', 'success');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show(
            'Could not grant access. This grant may already exist.',
            'error'
          );
        },
      });
  }
  revoke() {
    if (!this.pendingRevoke || this.saving()) return;
    this.saving.set(true);
    this.api.revokeAdminPermissionGrant(this.pendingRevoke.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.pendingRevoke = null;
        this.load();
        this.toast.show('Permission revoked.', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.toast.show('Could not revoke permission.', 'error');
      },
    });
  }
}
