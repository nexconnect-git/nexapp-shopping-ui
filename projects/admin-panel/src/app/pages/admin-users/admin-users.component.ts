import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, AuthService, ToastService } from '@shared/public-api';
import { NgIf, NgFor, NgClass } from '@angular/common';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor, NgClass],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  adminUsers: any[] = [];
  isLoading = false;
  isSubmitting = false;
  createForm: FormGroup;
  showForm = false;

  constructor() {
    this.createForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', Validators.required],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      account_type: ['admin', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.auth.isSuperUser()) {
      this.loadUsers();
    } else {
      this.toast.show('You do not have permission to view this page.', 'error');
    }
  }

  loadUsers() {
    this.isLoading = true;
    this.api.getAdminUsers().subscribe({
      next: (res: any) => {
        this.adminUsers = res.results || res;
        this.isLoading = false;
      },
      error: (err) => {
        this.toast.show('Error loading admin users.', 'error');
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  onSubmit() {
    if (this.createForm.invalid) {
      this.toast.show('Please fill out all required fields correctly.', 'error');
      return;
    }

    this.isSubmitting = true;
    const payload = this.createForm.value;

    this.api.createAdminUser(payload).subscribe({
      next: () => {
        this.toast.show('Admin user created successfully.', 'success');
        this.isSubmitting = false;
        this.showForm = false;
        this.createForm.reset({ account_type: 'admin' });
        this.loadUsers();
      },
      error: (err) => {
        let msg = 'Failed to create user.';
        if (err.error && typeof err.error === 'object') {
          msg = Object.values(err.error).map((e: any) => Array.isArray(e) ? e[0] : e).join(', ');
        }
        this.toast.show(msg, 'error');
        this.isSubmitting = false;
        console.error(err);
      }
    });
  }

  deleteUser(id: string) {
    if (confirm('Are you sure you want to delete this admin account?')) {
      this.api.deleteAdminUser(id).subscribe({
        next: () => {
          this.toast.show('User deleted successfully.', 'success');
          this.loadUsers();
        },
        error: (err) => {
          this.toast.show('Failed to delete user.', 'error');
          console.error(err);
        }
      });
    }
  }
}


