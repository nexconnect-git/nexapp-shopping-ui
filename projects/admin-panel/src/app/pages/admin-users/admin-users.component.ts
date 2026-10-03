import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  apiErrorMessage,
  ApiService,
  AuthService,
  ToastService,
} from '@shared/public-api';
import { NgClass } from '@angular/common';
import { DynamicTableComponent, TableCellDirective, DynamicTableColumn } from '@shared/public-api';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgClass,
    DynamicTableComponent,
    TableCellDirective,
  ],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
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

  totalItems = 0;
  page = 1;

  tableColumns: DynamicTableColumn[] = [
    { key: 'user', label: 'User', flex: '1.5fr', minWidth: 200 },
    { key: 'contact', label: 'Contact Info', flex: '1.5fr', minWidth: 240 },
    { key: 'role', label: 'Role', flex: '1fr', minWidth: 130 },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'joined', label: 'Joined', flex: '1fr', minWidth: 140 },
    { key: 'actions', label: 'Actions', flex: '0.5fr', minWidth: 80, align: 'right' },
  ];

  constructor() {
    this.createForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', Validators.required],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      account_type: ['admin', Validators.required],
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
    this.api.getAdminUsers({ page: this.page }).subscribe({
      next: (res: any) => {
        this.adminUsers = res.results || res;
        this.totalItems = res.count || this.adminUsers.length;
        this.isLoading = false;
      },
      error: (err) => {
        this.toast.show('Error loading admin users.', 'error');
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  onPageChange(page: number) {
    this.page = page;
    this.loadUsers();
  }

  onSubmit() {
    if (this.createForm.invalid) {
      this.toast.show(
        'Please fill out all required fields correctly.',
        'error'
      );
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
        this.toast.show(
          apiErrorMessage(err, 'Failed to create user.'),
          'error'
        );
        this.isSubmitting = false;
        console.error(err);
      },
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
        },
      });
    }
  }
}
