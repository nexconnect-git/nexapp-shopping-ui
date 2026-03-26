import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, AuthService } from '@shared/public-api';
import { NgIf, NgFor, NgClass } from '@angular/common';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIf, NgFor, NgClass],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  adminUsers: any[] = [];
  isLoading = false;
  isSubmitting = false;
  
  createForm: FormGroup;
  showForm = false;
  errorMsg = '';
  successMsg = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private fb: FormBuilder
  ) {
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
      this.errorMsg = 'You do not have permission to view this page.';
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
        this.errorMsg = 'Error loading admin users.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  onSubmit() {
    if (this.createForm.invalid) {
      this.errorMsg = 'Please fill out all required fields correctly.';
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';
    this.successMsg = '';

    const payload = this.createForm.value;
    
    this.api.createAdminUser(payload).subscribe({
      next: () => {
        this.successMsg = 'Admin user created successfully.';
        this.isSubmitting = false;
        this.showForm = false;
        this.createForm.reset({ account_type: 'admin' });
        this.loadUsers();
      },
      error: (err) => {
        let msg = 'Failed to create user.';
        if (err.error && typeof err.error === 'object') {
          // Flatten error messages manually or get first one
          msg = Object.values(err.error).map((e: any) => Array.isArray(e) ? e[0] : e).join(', ');
        }
        this.errorMsg = msg;
        this.isSubmitting = false;
        console.error(err);
      }
    });
  }

  deleteUser(id: string) {
    if (confirm('Are you sure you want to delete this admin account?')) {
      this.api.deleteAdminUser(id).subscribe({
        next: () => {
          this.successMsg = 'User deleted successfully.';
          this.loadUsers();
        },
        error: (err) => {
          this.errorMsg = 'Failed to delete user.';
          console.error(err);
        }
      });
    }
  }
}
