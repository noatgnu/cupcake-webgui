import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor, CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { WailsService } from './services/wails.service';

function initializeApiUrl(wailsService: WailsService): () => Promise<void> {
  return async () => {
    if (environment.isWails) {
      const port = await wailsService.getBackendPort();
      environment.apiUrl = `http://localhost:${port}/api/v1`;
      environment.websocketUrl = `ws://localhost:${port}/ws`;
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    { provide: CUPCAKE_CORE_CONFIG, useFactory: () => ({ apiUrl: environment.apiUrl }), deps: [] },
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApiUrl,
      deps: [WailsService],
      multi: true
    }
  ]
};
