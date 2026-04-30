import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AlertService, ApiService, AuthService } from '@shared/public-api';
import { NxPalettePickerComponent } from '../../design-system/index';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NxPalettePickerComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private alerts = inject(AlertService);
  private router = inject(Router);

  form: any = {};
  avatarPreview = signal<string | null>(null);
  loading = signal(true);
  saving = signal(false);
  avatarUploading = signal(false);
  isEditing = false;
  recentOrders = signal<any[]>([]);
  loyaltyPoints = signal<number>(0);
  reorderingId = signal<string | null>(null);

  ngOnInit() {
    this.api.getLoyalty().subscribe({
      next: (l) => this.loyaltyPoints.set(l.points ?? 0),
      error: () => {}
    });
    this.api.getProfile().subscribe({
      next: (u) => {
        this.form = { ...u };
        if (u.avatar) this.avatarPreview.set(u.avatar);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.api.getOrders().subscribe({
      next: (res) => {
        const orders = (res.results || res) as any[];
        this.recentOrders.set(orders.slice(0, 5));
      },
      error: () => { /* ignore */ }
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
    this.api.updateProfile(this.form).subscribe({
      next: (u) => {
        this.auth.updateUserData(u);
        this.alerts.success('Profile updated successfully.');
        this.saving.set(false);
        this.isEditing = false;
      },
      error: (err) => {
        const e = err.error;
        this.alerts.error(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Update failed.');
        this.saving.set(false);
      }
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  initials() {
    const u = this.form;
    if (!u) return '?';
    return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
  }

  orderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      placed: 'Placed', confirmed: 'Confirmed', preparing: 'Preparing',
      picked_up: 'Picked Up', on_the_way: 'On the Way',
      delivered: 'Delivered', cancelled: 'Cancelled'
    };
    return map[status] || status;
  }

  orderStatusClass(status: string): string {
    if (status === 'delivered') return 'delivered';
    if (status === 'cancelled') return 'cancelled';
    if (['on_the_way', 'picked_up'].includes(status)) return 'transit';
    return 'active';
  }

  reorder(orderId: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.reorderingId.set(orderId);
    this.api.reorder(orderId).subscribe({
      next: (cart) => {
        this.reorderingId.set(null);
        this.api.refreshCartCount();
        if (cart.skipped?.length) {
          this.alerts.warning(`${cart.skipped.length} item(s) were unavailable and skipped.`, 'Some items were skipped');
        } else {
          this.alerts.success('Basket rebuilt from your recent order.');
        }
        this.router.navigate(['/cart']);
      },
      error: () => {
        this.reorderingId.set(null);
        this.alerts.error('Could not reorder this basket right now.');
      }
    });
  }
}
