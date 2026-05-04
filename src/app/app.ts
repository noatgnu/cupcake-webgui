import { Component, signal, inject, OnInit, OnDestroy, DOCUMENT, effect, ChangeDetectionStrategy, untracked } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { filter } from 'rxjs/operators';

import { SiteConfigService, ThemeService, ToastService, ToastContainerComponent, AuthService, WebSocketService, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
import { CommunicationWebSocketService } from '@noatgnu/cupcake-mint-chocolate';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgbModule, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('cupcake');
  protected readonly environment = environment;

  private document = inject(DOCUMENT);
  private titleService = inject(Title);
  private router = inject(Router);

  private siteConfigService = inject(SiteConfigService);
  private themeService = inject(ThemeService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private coreWsService = inject(WebSocketService);
  private wsService = inject(CommunicationWebSocketService);
  private asyncTaskService = inject(AsyncTaskMonitorService);

  private themeEffect = effect(() => {
    this.themeService.isDark();
    const config = this.siteConfigService.siteConfig();
    untracked(() => {
      this.updatePrimaryColorTheme(config.primaryColor || '#1976d2');
    });
  });

  private authEffect = effect(() => {
    const user = this.authService.currentUser();
    untracked(() => {
      if (user) {
        this.coreWsService.connect();
        this.wsService.connect(environment.websocketUrl, this.authService.getAccessToken()!);
        this.asyncTaskService.startRealtimeUpdates();
      } else {
        this.coreWsService.disconnect();
        this.wsService.disconnect();
        this.asyncTaskService.stopRealtimeUpdates();
      }
    });
  });

  ngOnInit(): void {
    this.initializeApp();
  }

  ngOnDestroy(): void {
    this.coreWsService.disconnect();
    this.wsService.disconnect();
  }

  private initializeApp(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      const siteName = this.siteConfigService.getSiteName();
      this.updatePageTitle(siteName);
    });

    this.toastService.show('Application initialized');
  }

  private updatePageTitle(siteName: string): void {
    this.titleService.setTitle(siteName);
  }

  private updatePrimaryColorTheme(primaryColor: string): void {
    const root = this.document.documentElement;
    const isDark = this.themeService.isDark();

    let adjustedPrimary = primaryColor;
    if (isDark) {
      adjustedPrimary = this.adjustColorForDarkMode(primaryColor);
    }

    const rgbValues = this.hexToRgb(adjustedPrimary);
    const darkerColor = this.adjustColorBrightness(adjustedPrimary, isDark ? -15 : -20);
    const lighterColor = this.adjustColorBrightness(adjustedPrimary, isDark ? 15 : 20);

    root.style.setProperty('--cupcake-primary', adjustedPrimary);
    root.style.setProperty('--cupcake-primary-rgb', rgbValues);
    root.style.setProperty('--cupcake-primary-dark', darkerColor);
    root.style.setProperty('--cupcake-primary-light', lighterColor);
  }

  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '25, 118, 210';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }

  private adjustColorBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  private adjustColorForDarkMode(hex: string): string {
    const rgb = this.hexToRgb(hex).split(', ').map(Number);
    const [r, g, b] = rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    if (luminance < 0.5) {
      const brightnessIncrease = Math.max(40, 80 * (0.5 - luminance));
      return this.adjustColorBrightness(hex, brightnessIncrease);
    }

    return this.adjustColorBrightness(hex, 10);
  }
}
