import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UploadedFile } from '../models';
import { ApiCoreService } from './api-core.service';

@Injectable({ providedIn: 'root' })
export class FileApi extends ApiCoreService {
  uploadFile(
    file: File,
    useOfImage = 'general_upload',
    clientUploadId = '',
  ): Observable<UploadedFile> {
    return this.post<UploadedFile>(
      'files/upload/',
      this.toFormData({
        file,
        use_of_image: useOfImage,
        client_upload_id: clientUploadId || undefined,
      }),
    );
  }

  getUploadedFiles(): Observable<UploadedFile[]> {
    return this.get<UploadedFile[]>('files/');
  }

  getUploadedFile(id: string): Observable<UploadedFile> {
    return this.get<UploadedFile>(`files/${id}/`);
  }
}
