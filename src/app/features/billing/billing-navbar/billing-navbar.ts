import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-billing-navbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './billing-navbar.html',
  styleUrl: './billing-navbar.scss',
})
export class BillingNavbar {
  private sidebarControl = inject(SidebarControl);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
