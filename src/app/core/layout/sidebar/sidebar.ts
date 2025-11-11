import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { ThemeService, AuthService, SiteConfigService } from '@noatgnu/cupcake-core';
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
  private subscription?: Subscription;

  currentUser$ = this.authService.currentUser$;
  isCollapsed = signal(false);
  currentUser = signal(this.authService.getCurrentUser());
  siteConfig$ = this.siteConfigService.config$;

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
    });
    this.subscription = this.sidebarControl.toggle$.subscribe(() => {
      this.isCollapsed.update(v => !v);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  navItems = [
    { icon: 'bi-house-door', label: 'Home', route: '/home' },
    { icon: 'bi-journal-text', label: 'Protocols', route: '/protocols' },
    { icon: 'bi-gear', label: 'Instruments', route: '/instruments' },
    { icon: 'bi-box-seam', label: 'Storage', route: '/storage' },
    { icon: 'bi-briefcase', label: 'Jobs', route: '/jobs' }
  ];

  adminItems = [
    { icon: 'bi-sliders', label: 'Site Config', route: '/home/site-config' }
  ];

  isAdmin(): boolean {
    const user = this.currentUser();
    return user ? (user.isStaff || user.isSuperuser) : false;
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
}
