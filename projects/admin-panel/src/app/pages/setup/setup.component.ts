import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
})
export class SetupComponent implements OnInit {
  setupForm: FormGroup;
  isLoading = true;
  isSubmitting = false;
  errorMsg = '';

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  constructor() {
    this.setupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit() {
    this.api.checkSetup().subscribe({
      next: (res: any) => {
        if (!res.needs_setup) {
          this.router.navigate(['/login']);
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.errorMsg = 'Could not verify system status.';
        this.isLoading = false;
      },
    });
  }

  onSubmit() {
    if (this.setupForm.invalid) {
      this.errorMsg = 'Please fill out all required fields correctly.';
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';

    const payload = this.setupForm.getRawValue();

    this.api.setupSuperuser(payload).subscribe({
      next: () => {
        this.auth.login(payload.username, payload.password).subscribe({
          next: (res) => {
            if (!this.auth.handleAuthResponse(res)) {
              this.errorMsg = 'This account is not allowed in the admin panel.';
              this.isSubmitting = false;
              return;
            }
            this.router.navigate(['/']);
          },
          error: () => {
            this.router.navigate(['/login']);
          },
        });
      },
      error: (err) => {
        let msg = 'Failed to create initial superuser.';
        if (err.error && typeof err.error === 'object') {
          msg = Object.values(err.error)
            .map((e: any) => (Array.isArray(e) ? e[0] : e))
            .join(', ');
        }
        this.errorMsg = msg;
        this.isSubmitting = false;
      },
    });
  }
}
