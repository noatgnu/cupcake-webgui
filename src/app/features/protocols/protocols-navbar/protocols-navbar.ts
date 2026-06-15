import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-protocols-navbar',
  imports: [RouterModule, NgbCollapse],
  templateUrl: './protocols-navbar.html',
  styleUrl: './protocols-navbar.scss'
})
export class ProtocolsNavbar {
  private sidebarControl = inject(SidebarControl);

  isMenuCollapsed = signal(true);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
