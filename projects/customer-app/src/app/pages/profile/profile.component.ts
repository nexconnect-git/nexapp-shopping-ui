import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthService, User } from '@shared/public-api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  form: any = {};
  avatarPreview = signal<string | null>(null);
  loading = signal(true);
  saving = signal(false);
  avatarUploading = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  ngOnInit() {
    this.api.getProfile().subscribe({
      next: (u) => { this.form = { ...u }; if (u.avatar) this.avatarPreview.set(u.avatar); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onAvatarChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => this.avatarPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
    this.avatarUploading.set(true);
    this.api.uploadAvatar(file).subscribe({
      next: (u) => { if (u.avatar) this.avatarPreview.set(u.avatar); this.avatarUploading.set(false); },
      error: () => this.avatarUploading.set(false)
    });
  }

  save() {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');
    this.api.updateProfile(this.form).subscribe({
      next: (u) => {
        this.auth.updateUserData(u);
        this.successMsg.set('Profile updated successfully.');
        this.saving.set(false);
      },
      error: (err) => {
        const e = err.error;
        this.errorMsg.set(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Update failed.');
        this.saving.set(false);
      }
    });
  }

  initials() {
    const u = this.form;
    if (!u) return '?';
    return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
  }
}
