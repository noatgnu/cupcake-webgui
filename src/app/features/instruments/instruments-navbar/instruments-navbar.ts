import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-instruments-navbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './instruments-navbar.html',
  styleUrl: './instruments-navbar.scss'
})
export class InstrumentsNavbar {
  private sidebarControl = inject(SidebarControl);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
