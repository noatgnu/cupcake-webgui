import { Component, signal, inject, OnInit, OnDestroy, DOCUMENT, effect } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { SiteConfigService, ThemeService, ToastService, ToastContainerComponent, PoweredByFooterComponent, AuthService } from '@noatgnu/cupcake-core';
import { CommunicationWebSocketService } from '@noatgnu/cupcake-mint-chocolate';
import { BehaviorSubject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgbModule, CommonModule, PoweredByFooterComponent, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('cupcake');
  protected readonly environment = environment;

  private appInitializedSubject = new BehaviorSubject<boolean>(false);
  public appInitialized$ = this.appInitializedSubject.asObservable();

  private themeEffect;
  private document = inject(DOCUMENT);
  private titleService = inject(Title);
  private router = inject(Router);
  private authSubscription?: Subscription;
  private configSubscription?: Subscription;

  constructor(
    private siteConfigService: SiteConfigService,
    private themeService: ThemeService,
    private toastService: ToastService,
    private authService: AuthService,
    private wsService: CommunicationWebSocketService
  ) {
    this.themeEffect = effect(() => {
      this.themeService.isDark();
      this.siteConfigService.getCurrentConfig().subscribe(currentConfig => {
        if (currentConfig) {
          this.updatePrimaryColorTheme(currentConfig.primaryColor || '#1976d2');
        }
      });
    });
  }

  ngOnInit(): void {
    this.initializeApp();
    this.initializeWebSocket();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
    this.wsService.disconnect();
  }

  private initializeWebSocket(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        console.log('User authenticated, connecting to WebSocket...');
        const token = this.authService.getAccessToken();
        if (token) {
          this.wsService.connect(environment.websocketUrl, token);
        } else {
          console.warn('User authenticated but no access token available');
        }
      } else {
        console.log('User not authenticated, disconnecting WebSocket...');
        this.wsService.disconnect();
      }
    });
  }

  private async initializeApp(): Promise<void> {
    try {
      this.configSubscription = this.siteConfigService.config$.subscribe(config => {
        this.updatePrimaryColorTheme(config.primaryColor || '#1976d2');
        this.updatePageTitle(config.siteName || 'Cupcake');
      });

      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        const siteName = this.siteConfigService.getSiteName();
        this.updatePageTitle(siteName);
      });

      this.appInitializedSubject.next(true);
      this.toastService.show("Application initialized")
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.appInitializedSubject.next(true);
    }
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

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `${r}, ${g}, ${b}`;
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
