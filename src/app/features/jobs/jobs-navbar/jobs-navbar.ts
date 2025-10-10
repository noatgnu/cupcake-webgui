import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-jobs-navbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './jobs-navbar.html',
  styleUrl: './jobs-navbar.scss'
})
export class JobsNavbar {
  private sidebarControl = inject(SidebarControl);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
