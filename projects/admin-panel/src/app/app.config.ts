import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor, API_BASE_URL, AUTH_PREFIX, DYNAMIC_TABLE_DEFAULTS } from '@shared/public-api';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    { provide: AUTH_PREFIX, useValue: 'admin' },
    {
      provide: DYNAMIC_TABLE_DEFAULTS,
      useValue: {
        emptyIcon: 'inbox',
        emptyMessage: 'No records found',
        emptySubMessage: 'Adjust filters or refresh the page.',
        itemsPerPage: 20,
        hasPagination: true,
      },
    }
  ]
};
