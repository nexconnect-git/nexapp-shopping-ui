import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  PersistentUploadService,
  PersistentUploadTask,
  UploadedFile,
} from '@shared/public-api';

@Component({
  selector: 'app-file-upload-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-upload-test.component.html',
  styleUrl: './file-upload-test.component.scss',
})
export class FileUploadTestComponent implements OnInit {
  private api = inject(ApiService);
  readonly uploadQueue = inject(PersistentUploadService);

  readonly useOfImageOptions = [
    { value: 'profile_image', label: 'Profile image' },
    { value: 'cover_image', label: 'Cover image' },
    { value: 'product_image', label: 'Product image' },
    { value: 'category_image', label: 'Category image' },
    { value: 'vendor_document', label: 'Vendor document' },
    { value: 'delivery_document', label: 'Delivery document' },
    { value: 'order_attachment', label: 'Order attachment' },
    { value: 'delivery_proof', label: 'Delivery proof' },
    { value: 'transaction_proof', label: 'Transaction proof' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'banner_image', label: 'Banner image' },
    { value: 'general_upload', label: 'General upload' },
  ];

  selectedFile = signal<File | null>(null);
  useOfImage = 'general_upload';
  uploading = signal(false);
  error = signal('');
  success = signal('');
  uploaded = signal<UploadedFile | null>(null);
  files = signal<UploadedFile[]>([]);
  tasks = this.uploadQueue.tasks;
  private lastCompletedTaskId = '';

  constructor() {
    effect(() => {
      const completed = this.tasks().find(
        (task) => task.status === 'completed' && task.result,
      );
      if (!completed || completed.id === this.lastCompletedTaskId) return;
      this.lastCompletedTaskId = completed.id;
      this.uploaded.set(completed.result || null);
      this.success.set('File uploaded successfully.');
      this.refreshFiles();
    });
  }

  ngOnInit(): void {
    void this.uploadQueue.initialize();
    this.refreshFiles();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] || null);
    this.error.set('');
    this.success.set('');
    this.uploaded.set(null);
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file || this.uploading()) return;

    this.uploading.set(true);
    this.error.set('');
    this.success.set('');
    this.uploadQueue
      .enqueue(file, this.useOfImage)
      .then(() => {
        this.uploading.set(false);
        this.success.set('Upload queued. It will resume automatically after refresh.');
      })
      .catch((err) => {
        this.uploading.set(false);
        this.error.set(this.readError(err));
      });
  }

  retry(task: PersistentUploadTask): void {
    void this.uploadQueue.retry(task.id);
  }

  remove(task: PersistentUploadTask): void {
    void this.uploadQueue.remove(task.id);
  }

  refreshFiles(): void {
    this.api.getUploadedFiles().subscribe({
      next: (files) => this.files.set(files),
      error: () => this.files.set([]),
    });
  }

  private readError(err: any): string {
    const fileError = err?.error?.file;
    if (Array.isArray(fileError)) return fileError.join(' ');
    if (typeof fileError === 'string') return fileError;
    return err?.error?.detail || err?.message || 'Upload failed.';
  }
}
