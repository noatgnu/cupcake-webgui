import { Component, inject, Input, Output, EventEmitter } from '@angular/core';

import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-home-navbar',
  imports: [],
  templateUrl: './home-navbar.html',
  styleUrl: './home-navbar.scss'
})
export class HomeNavbar {
  private sidebarControl = inject(SidebarControl);

  @Input() activeSection: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks' | 'devices' = 'dashboard';
  @Output() sectionChange = new EventEmitter<'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks' | 'devices'>();

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }

  navigateToSection(section: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks' | 'devices'): void {
    this.sectionChange.emit(section);
  }
}
