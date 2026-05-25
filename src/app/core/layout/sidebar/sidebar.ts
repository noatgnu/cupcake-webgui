import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { ThemeService, AuthService, SiteConfigService, DemoModeService } from '@noatgnu/cupcake-core';
import { NotificationDropdown } from '../../../shared/components/notification-dropdown/notification-dropdown';
import { MessagingDropdown } from '../../../shared/components/messaging-dropdown/messaging-dropdown';
import { AsyncTaskDropdown } from '../../../shared/components/async-task-dropdown/async-task-dropdown';
import { SidebarControl } from '../../services/sidebar-control';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, CommonModule, NotificationDropdown, MessagingDropdown, AsyncTaskDropdown],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  isCollapsed = signal(false);
  currentUser = this.authService.currentUser;
  siteConfig = this.siteConfigService.siteConfig;
  isDemoMode = signal(false);

  constructor() {
    effect(() => {
      const info = this.demoModeService.demoMode();
      this.isDemoMode.set(info.isActive);
    });
  }

  ngOnInit(): void {
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
    { icon: 'bi-briefcase', label: 'Jobs', route: '/jobs', featureFlag: 'showMetadataTables' },
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

  isAppliance = !!(environment as any).isAppliance;

  adminItems = [
    { icon: 'bi-sliders', label: 'Site Config', route: '/admin/site-config', requiresSuperuser: false },
    ...((environment as any).isAppliance ? [
      { icon: 'bi-hdd-network', label: 'Storage', route: '/admin/storage', requiresSuperuser: false },
      { icon: 'bi-archive', label: 'Backup', route: '/admin/backup', requiresSuperuser: false }
    ] : [])
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
    this.themeService.toggleMode();
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
