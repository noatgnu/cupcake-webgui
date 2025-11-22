import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, ActivatedRoute } from '@angular/router';
import { HomeNavbar } from '../home-navbar/home-navbar';
import { TasksView } from '../tasks-view/tasks-view';
import { Subscription } from 'rxjs';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import type { Session, TimeKeeper } from '@noatgnu/cupcake-red-velvet';
import { TimeKeeperService } from '@noatgnu/cupcake-red-velvet';
import { MessageThreadService, NotificationService } from '@noatgnu/cupcake-mint-chocolate';
import type { MessageThread, Notification } from '@noatgnu/cupcake-mint-chocolate';
import { SiteConfigService } from '@noatgnu/cupcake-core';
import type { SiteConfig } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-home',
  imports: [CommonModule, HomeNavbar, RouterOutlet, TasksView, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sessionService = inject(SessionService);
  private timeKeeperService = inject(TimeKeeperService);
  private messageThreadService = inject(MessageThreadService);
  private notificationService = inject(NotificationService);
  private siteConfigService = inject(SiteConfigService);
  private fragmentSubscription?: Subscription;

  activeSection: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks' = 'dashboard';

  recentSessions = signal<Session[]>([]);
  activeTimeKeeper = signal<TimeKeeper | null>(null);
  recentMessages = signal<MessageThread[]>([]);
  recentNotifications = signal<Notification[]>([]);
  siteConfig = signal<SiteConfig | null>(null);

  loadingSessions = signal(false);
  loadingTimeKeeper = signal(false);
  loadingMessages = signal(false);
  loadingNotifications = signal(false);

  ngOnInit(): void {
    this.updateActiveSection();

    this.fragmentSubscription = this.route.fragment.subscribe(fragment => {
      if (fragment === 'tasks') {
        this.activeSection = 'tasks';
      }
    });

    this.siteConfigService.config$.subscribe(config => {
      this.siteConfig.set(config);
    });

    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    if (this.fragmentSubscription) {
      this.fragmentSubscription.unsubscribe();
    }
  }

  loadDashboardData(): void {
    this.loadRecentSessions();
    this.loadActiveTimeKeeper();
    this.loadRecentMessages();
    this.loadRecentNotifications();
  }

  loadRecentSessions(): void {
    this.loadingSessions.set(true);
    this.sessionService.getSessions({ limit: 5, ordering: '-created_at' }).subscribe({
      next: (response) => {
        this.recentSessions.set(response.results);
        this.loadingSessions.set(false);
      },
      error: (err) => {
        console.error('Error loading recent sessions:', err);
        this.loadingSessions.set(false);
      }
    });
  }

  loadActiveTimeKeeper(): void {
    this.loadingTimeKeeper.set(true);
    this.timeKeeperService.getTimeKeepers({ limit: 1, ordering: '-created_at' }).subscribe({
      next: (response) => {
        const activeTimer = response.results.find(tk => tk.started);
        this.activeTimeKeeper.set(activeTimer || null);
        this.loadingTimeKeeper.set(false);
      },
      error: (err) => {
        console.error('Error loading active timekeeper:', err);
        this.loadingTimeKeeper.set(false);
      }
    });
  }

  loadRecentMessages(): void {
    const config = this.siteConfig();
    if (!config?.uiFeaturesWithDefaults?.show_messages) {
      return;
    }

    this.loadingMessages.set(true);
    this.messageThreadService.getMessageThreads({ limit: 5, ordering: '-updated_at' }).subscribe({
      next: (response) => {
        this.recentMessages.set(response.results);
        this.loadingMessages.set(false);
      },
      error: (err) => {
        console.error('Error loading recent messages:', err);
        this.loadingMessages.set(false);
      }
    });
  }

  loadRecentNotifications(): void {
    const config = this.siteConfig();
    if (!config?.uiFeaturesWithDefaults?.show_notifications) {
      return;
    }

    this.loadingNotifications.set(true);
    this.notificationService.getNotifications({ limit: 5, ordering: '-created_at', isRead: false }).subscribe({
      next: (response) => {
        this.recentNotifications.set(response.results);
        this.loadingNotifications.set(false);
      },
      error: (err) => {
        console.error('Error loading recent notifications:', err);
        this.loadingNotifications.set(false);
      }
    });
  }

  isSessionCompleted(session: Session): boolean {
    if (!session.startedAt || !session.endedAt) {
      return false;
    }
    const endDate = new Date(session.endedAt);
    const now = new Date();
    return endDate <= now;
  }

  private updateActiveSection(): void {
    const urlSegments = this.router.url.split('/');
    const lastSegment = urlSegments[urlSegments.length - 1].split('#')[0];
    const fragment = this.route.snapshot.fragment;

    if (fragment === 'tasks') {
      this.activeSection = 'tasks';
    } else if (lastSegment === 'projects' || lastSegment === 'lab-groups' || lastSegment === 'users' || lastSegment === 'messages' || lastSegment === 'notifications' || lastSegment === 'profile' || lastSegment === 'site-config' || lastSegment === 'tasks') {
      this.activeSection = lastSegment as typeof this.activeSection;
    } else {
      this.activeSection = 'dashboard';
    }
  }

  showSection(section: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks'): void {
    this.activeSection = section;
    if (section === 'dashboard') {
      this.router.navigate(['/home']);
    } else if (section === 'tasks') {
      this.router.navigate(['/home'], { fragment: 'tasks' });
    } else {
      this.router.navigate(['/home', section]);
    }
  }
}
