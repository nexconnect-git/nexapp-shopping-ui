import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import AuraBase from '@primeuix/themes/aura/base';
import dialog from '@primeuix/themes/aura/dialog';
import datatable from '@primeuix/themes/aura/datatable';
import button from '@primeuix/themes/aura/button';
import paginator from '@primeuix/themes/aura/paginator';
import select from '@primeuix/themes/aura/select';
import checkbox from '@primeuix/themes/aura/checkbox';
import radiobutton from '@primeuix/themes/aura/radiobutton';
import inputtext from '@primeuix/themes/aura/inputtext';
import ripple from '@primeuix/themes/aura/ripple';
import { adminConnectionInterceptor } from './services/admin-connection.service';
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
  cacheInterceptor,
  DYNAMIC_TABLE_DEFAULTS,
} from '@shared/public-api';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: definePreset({ ...AuraBase, components: { dialog, datatable, button, paginator, select, checkbox, radiobutton, inputtext, ripple } }, { semantic: { primary: {50:'#f5f3ff',100:'#efedff',200:'#dedaff',300:'#bdb7f5',400:'#8e85eb',500:'#5850d9',600:'#443bb9',700:'#393294',800:'#302b77',900:'#29265d',950:'#191638'} } }), options: {darkModeSelector: false} } }),
    provideHttpClient(withInterceptors([authInterceptor, adminConnectionInterceptor, cacheInterceptor])),
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
        contentSizing: true,
      },
    },
  ],
};
