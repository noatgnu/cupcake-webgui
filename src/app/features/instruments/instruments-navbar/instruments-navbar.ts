import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-instruments-navbar',
  imports: [RouterModule],
  templateUrl: './instruments-navbar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './instruments-navbar.scss'
})
export class InstrumentsNavbar {
  private sidebarControl = inject(SidebarControl);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
