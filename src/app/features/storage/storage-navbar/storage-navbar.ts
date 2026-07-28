import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { NgbCollapse, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-storage-navbar',
  imports: [RouterModule, NgbDropdownModule, NgbCollapse],
  templateUrl: './storage-navbar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './storage-navbar.scss'
})
export class StorageNavbar {
  private sidebarControl = inject(SidebarControl);

  isMenuCollapsed = signal(true);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
