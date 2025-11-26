import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { ThemeService, AuthService, SiteConfigService, DemoModeService } from '@noatgnu/cupcake-core';
import type { SiteConfig } from '@noatgnu/cupcake-core';
import { NotificationDropdown } from '../../../shared/components/notification-dropdown/notification-dropdown';
import { MessagingDropdown } from '../../../shared/components/messaging-dropdown/messaging-dropdown';
import { AsyncTaskDropdown } from '../../../shared/components/async-task-dropdown/async-task-dropdown';
import { SidebarControl } from '../../services/sidebar-control';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, CommonModule, NotificationDropdown, MessagingDropdown, AsyncTaskDropdown],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit, OnDestroy {
  private offcanvasService = inject(NgbOffcanvas);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private sidebarControl = inject(SidebarControl);
  private siteConfigService = inject(SiteConfigService);
  private demoModeService = inject(DemoModeService);
  private subscription?: Subscription;

  currentUser$ = this.authService.currentUser$;
  isCollapsed = signal(false);
  currentUser = signal(this.authService.getCurrentUser());
  siteConfig = signal<SiteConfig | null>(null);
  siteConfig$ = this.siteConfigService.config$;
  isDemoMode = signal(false);

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
    });
    this.siteConfigService.config$.subscribe(config => {
      this.siteConfig.set(config);
    });
    this.demoModeService.demoMode$.subscribe(info => {
      this.isDemoMode.set(info.isActive);
    });
    this.subscription = this.sidebarControl.toggle$.subscribe(() => {
      this.isCollapsed.update(v => !v);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private allNavItems = [
    { icon: 'bi-house-door', label: 'Home', route: '/home', featureFlag: null },
    { icon: 'bi-journal-text', label: 'Protocols', route: '/protocols', featureFlag: 'showProtocols' },
    { icon: 'bi-gear', label: 'Instruments', route: '/instruments', featureFlag: 'showInstruments' },
    { icon: 'bi-box-seam', label: 'Storage', route: '/storage', featureFlag: 'showStorage' },
    { icon: 'bi-briefcase', label: 'Jobs', route: '/jobs', featureFlag: null },
    { icon: 'bi-cash-coin', label: 'Billing', route: '/billing', featureFlag: 'showBilling' }
  ];

  navItems = computed(() => {
    const config = this.siteConfig();
    if (!config?.uiFeaturesWithDefaults) {
      return this.allNavItems;
    }
    return this.allNavItems.filter(item => {
      if (!item.featureFlag) return true;
      return config.uiFeaturesWithDefaults[item.featureFlag] !== false;
    });
  });

  adminItems = [
    { icon: 'bi-sliders', label: 'Site Config', route: '/admin/site-config', requiresSuperuser: false }
  ];

  superuserItems = [
    { icon: 'bi-cpu-fill', label: 'Worker Status', route: '/admin/worker-status', requiresSuperuser: true }
  ];

  isAdmin(): boolean {
    const user = this.currentUser();
    return user ? (user.isStaff || user.isSuperuser) : false;
  }

  isSuperuser(): boolean {
    const user = this.currentUser();
    return user ? user.isSuperuser : false;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  getThemeIcon(): string {
    return this.themeService.getThemeIcon();
  }

  getThemeLabel(): string {
    return this.themeService.getThemeLabel();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  showNotifications(): boolean {
    const config = this.siteConfig();
    return config?.uiFeaturesWithDefaults?.['showNotifications'] !== false;
  }

  showMessages(): boolean {
    const config = this.siteConfig();
    return config?.uiFeaturesWithDefaults?.['showMessages'] !== false;
  }
}
