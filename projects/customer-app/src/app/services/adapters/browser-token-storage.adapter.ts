import { Injectable, inject } from '@angular/core';
import type { TokenStorage } from '@nexconnect/customer-api-client';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';

@Injectable({ providedIn: 'root' })
export class BrowserTokenStorageAdapter implements TokenStorage {
  private readonly auth = inject(SharedAuthService);

  async getAccessToken(): Promise<string | null> {
    return this.auth.getToken();
  }

  async getRefreshToken(): Promise<string | null> {
    return this.auth.getRefreshToken();
  }

  async setTokens(tokens: {
    access?: string;
    refresh?: string | null;
  }): Promise<void> {
    await this.auth.setTokens(tokens);
  }

  async clearTokens(): Promise<void> {
    this.auth.clearInvalidSession();
  }
}
