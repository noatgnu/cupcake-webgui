import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-storage-navbar',
  imports: [CommonModule, RouterModule, NgbDropdownModule],
  templateUrl: './storage-navbar.html',
  styleUrl: './storage-navbar.scss'
})
export class StorageNavbar {
  private sidebarControl = inject(SidebarControl);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }
}
