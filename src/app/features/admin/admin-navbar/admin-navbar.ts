import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '@noatgnu/cupcake-core';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-navbar',
  imports: [RouterModule, NgbCollapse],
  templateUrl: './admin-navbar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-navbar.scss',
})
export class AdminNavbar {
  private sidebarControl = inject(SidebarControl);
  private authService = inject(AuthService);
  isAppliance = !!(environment as any).isAppliance;
  isSuperuser = computed(() => !!this.authService.currentUser()?.isSuperuser);

  isMenuCollapsed = signal(true);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
