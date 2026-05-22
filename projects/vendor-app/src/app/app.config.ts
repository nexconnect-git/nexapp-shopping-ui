import {
  type ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  API_BASE_URL,
  AUTH_PREFIX,
  authInterceptor,
  DYNAMIC_TABLE_DEFAULTS,
} from '@shared/public-api';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    { provide: AUTH_PREFIX, useValue: 'vendor' },
    {
      provide: DYNAMIC_TABLE_DEFAULTS,
      useValue: {
        emptyIcon: 'inventory_2',
        emptyMessage: 'Nothing to show yet',
        emptySubMessage: 'Add or sync records to populate this table.',
        itemsPerPage: 20,
        hasPagination: true,
      },
    },
  ],
};
