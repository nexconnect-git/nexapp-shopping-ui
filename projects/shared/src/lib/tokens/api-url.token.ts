import { InjectionToken } from '@angular/core';

/** Base URL for all API calls. Defaults to '/api' for web; override in mobile app.config.ts. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => '/api',
});
