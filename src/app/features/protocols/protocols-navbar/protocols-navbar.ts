import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-protocols-navbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './protocols-navbar.html',
  styleUrl: './protocols-navbar.scss'
})
export class ProtocolsNavbar {
  private sidebarControl = inject(SidebarControl);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
