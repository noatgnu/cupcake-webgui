import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor, CUPCAKE_CORE_CONFIG, CupcakeCoreConfig } from '@noatgnu/cupcake-core';
import { DesktopService } from '@noatgnu/cupcake-vanilla';

/**
 * Points the core API URL, which the WebSocket URL is derived from, at the
 * port the embedded backend actually bound before the first navigation; the
 * compile-time desktop environments assume port 8000, which the backend skips
 * when it is taken.
 */
async function resolveDesktopBackendUrls(): Promise<void> {
  const desktop = inject(DesktopService);
  if (!desktop.isDesktop) {
    return;
  }
  const coreConfig = inject(CUPCAKE_CORE_CONFIG);
  try {
    const port = await desktop.getBackendPort();
    coreConfig.apiUrl = `http://localhost:${port}/api/v1`;
  } catch (error) {
    await desktop.logToFile(`Failed to resolve backend port, using ${coreConfig.apiUrl}: ${error}`);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: environment.apiUrl } satisfies CupcakeCoreConfig },
    provideAppInitializer(resolveDesktopBackendUrls),
    provideHttpClient(withXhr(),
      withInterceptors([authInterceptor])
    )
  ]
};
