import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-navbar',
  imports: [RouterModule],
  templateUrl: './admin-navbar.html',
  styleUrl: './admin-navbar.scss',
})
export class AdminNavbar {
  private sidebarControl = inject(SidebarControl);
  isAppliance = !!(environment as any).isAppliance;

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
