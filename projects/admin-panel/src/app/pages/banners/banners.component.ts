import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

interface PlatformBanner {
  id: string;
  title: string;
  subtitle: string;
  badge_text: string;
  cta_label: string;
  cta_url: string;
  image: string | null;
  bg_gradient: string;
  display_order: number;
  is_active: boolean;
}

@Component({
  selector: 'app-banners',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './banners.component.html',
  styleUrl: './banners.component.scss',
})
export class BannersComponent implements OnInit {
  private api = inject(ApiService);
  banners = signal<PlatformBanner[]>([]);
  loading = signal(true);
  saving = signal(false);
  showModal = signal(false);
  editTarget = signal<PlatformBanner | null>(null);
  error = signal('');
  selectedFile: File | null = null;

  form = this.emptyForm();

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getAdminBanners().subscribe({
      next: (items) => {
        this.banners.set(items || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate() {
    this.editTarget.set(null);
    this.selectedFile = null;
    this.form = this.emptyForm();
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(banner: PlatformBanner) {
    this.editTarget.set(banner);
    this.selectedFile = null;
    this.form = { ...banner };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  save() {
    if (!this.form.title.trim()) {
      this.error.set('Title is required.');
      return;
    }
    const payload = new FormData();
    Object.entries(this.form).forEach(([key, value]) => {
      if (key === 'id' || key === 'image') return;
      payload.append(key, String(value ?? ''));
    });
    if (this.selectedFile) payload.append('image', this.selectedFile);

    this.saving.set(true);
    this.error.set('');
    const target = this.editTarget();
    const req = target
      ? this.api.updateAdminBanner(target.id, payload)
      : this.api.createAdminBanner(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(
          err.error?.title?.[0] || err.error?.detail || 'Save failed.',
        );
      },
    });
  }

  toggleActive(banner: PlatformBanner) {
    this.api
      .updateAdminBanner(banner.id, { is_active: !banner.is_active })
      .subscribe({
        next: () => this.load(),
      });
  }

  delete(banner: PlatformBanner) {
    if (!confirm(`Delete banner "${banner.title}"?`)) return;
    this.api
      .deleteAdminBanner(banner.id)
      .subscribe({ next: () => this.load() });
  }

  private emptyForm(): PlatformBanner {
    return {
      id: '',
      title: '',
      subtitle: '',
      badge_text: '',
      cta_label: 'Order Now',
      cta_url: '/shops',
      image: null,
      bg_gradient: '#6C2BFF',
      display_order: 0,
      is_active: true,
    };
  }
}
