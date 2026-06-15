import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-navbar',
  imports: [RouterModule, NgbCollapse],
  templateUrl: './admin-navbar.html',
  styleUrl: './admin-navbar.scss',
})
export class AdminNavbar {
  private sidebarControl = inject(SidebarControl);
  isAppliance = !!(environment as any).isAppliance;

  isMenuCollapsed = signal(true);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
