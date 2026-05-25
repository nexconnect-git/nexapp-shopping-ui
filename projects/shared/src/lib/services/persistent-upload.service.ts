import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { UploadedFile } from '../models';

export type UploadTaskStatus = 'queued' | 'uploading' | 'completed' | 'failed';

export interface PersistentUploadTask {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  useOfImage: string;
  status: UploadTaskStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: UploadedFile;
}

const DB_NAME = 'nexconnect_uploads';
const DB_VERSION = 1;
const STORE_NAME = 'upload_tasks';

@Injectable({ providedIn: 'root' })
export class PersistentUploadService {
  private api = inject(ApiService);
  private dbPromise: Promise<IDBDatabase> | null = null;
  private initialized = false;

  readonly tasks = signal<PersistentUploadTask[]>([]);

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.refreshTasks();
    for (const task of this.tasks()) {
      if (task.status === 'queued' || task.status === 'uploading') {
        void this.start(task.id);
      }
    }
  }

  async enqueue(file: File, useOfImage: string): Promise<PersistentUploadTask> {
    await this.initialize();
    const now = new Date().toISOString();
    const task: PersistentUploadTask = {
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      fileSize: file.size,
      useOfImage,
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.putTask(task);
    await this.refreshTasks();
    void this.start(task.id);
    return task;
  }

  async retry(id: string): Promise<void> {
    const task = await this.getTask(id);
    if (!task) return;
    await this.putTask({
      ...task,
      status: 'queued',
      error: '',
      updatedAt: new Date().toISOString(),
    });
    await this.refreshTasks();
    void this.start(id);
  }

  async remove(id: string): Promise<void> {
    const db = await this.openDb();
    await this.requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
    await this.refreshTasks();
  }

  private async start(id: string): Promise<void> {
    const task = await this.getTask(id);
    if (!task || task.status === 'completed') return;

    const uploadingTask = {
      ...task,
      status: 'uploading' as const,
      attempts: task.attempts + 1,
      error: '',
      updatedAt: new Date().toISOString(),
    };
    await this.putTask(uploadingTask);
    await this.refreshTasks();

    this.api.uploadFile(task.file, task.useOfImage, task.id).subscribe({
      next: (result) => {
        void this.completeTask(id, result);
      },
      error: (err) => {
        void this.failTask(id, this.readError(err));
      },
    });
  }

  private async completeTask(id: string, result: UploadedFile): Promise<void> {
    const task = await this.getTask(id);
    if (!task) return;
    await this.putTask({
      ...task,
      status: 'completed',
      result,
      error: '',
      updatedAt: new Date().toISOString(),
    });
    await this.refreshTasks();
  }

  private async failTask(id: string, error: string): Promise<void> {
    const task = await this.getTask(id);
    if (!task) return;
    await this.putTask({
      ...task,
      status: 'failed',
      error,
      updatedAt: new Date().toISOString(),
    });
    await this.refreshTasks();
  }

  private async refreshTasks(): Promise<void> {
    const db = await this.openDb();
    const tasks = await this.requestToPromise<PersistentUploadTask[]>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
    );
    this.tasks.set(tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  private async getTask(id: string): Promise<PersistentUploadTask | undefined> {
    const db = await this.openDb();
    return this.requestToPromise<PersistentUploadTask | undefined>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id),
    );
  }

  private async putTask(task: PersistentUploadTask): Promise<void> {
    const db = await this.openDb();
    await this.requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(task));
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private readError(err: any): string {
    const fileError = err?.error?.file;
    if (Array.isArray(fileError)) return fileError.join(' ');
    if (typeof fileError === 'string') return fileError;
    return err?.error?.detail || err?.message || 'Upload failed.';
  }
}
