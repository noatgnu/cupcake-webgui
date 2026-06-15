import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-jobs-navbar',
  imports: [RouterModule, NgbCollapse],
  templateUrl: './jobs-navbar.html',
  styleUrl: './jobs-navbar.scss'
})
export class JobsNavbar {
  private sidebarControl = inject(SidebarControl);

  isMenuCollapsed = signal(true);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
