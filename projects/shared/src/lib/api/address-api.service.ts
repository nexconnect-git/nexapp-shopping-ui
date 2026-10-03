import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiCoreService } from './api-core.service';

@Injectable({ providedIn: 'root' })
export class AddressApi extends ApiCoreService {
  getAddresses(): Observable<any> {
    return this.get('auth/addresses/');
  }
}
