import { Component, signal, inject, OnInit, OnDestroy, effect, ChangeDetectionStrategy, untracked } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { filter } from 'rxjs/operators';

import { SiteConfigService, ToastService, ToastContainerComponent, AuthService, WebSocketService, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
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

  private titleService = inject(Title);
  private router = inject(Router);

  private siteConfigService = inject(SiteConfigService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private coreWsService = inject(WebSocketService);
  private wsService = inject(CommunicationWebSocketService);
  private asyncTaskService = inject(AsyncTaskMonitorService);

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

}
