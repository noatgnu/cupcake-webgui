import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarControl } from '../../../core/services/sidebar-control';

@Component({
  selector: 'app-home-navbar',
  imports: [CommonModule],
  templateUrl: './home-navbar.html',
  styleUrl: './home-navbar.scss'
})
export class HomeNavbar {
  private sidebarControl = inject(SidebarControl);

  @Input() activeSection: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks' = 'dashboard';
  @Output() sectionChange = new EventEmitter<'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks'>();

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }

  navigateToSection(section: 'dashboard' | 'projects' | 'lab-groups' | 'users' | 'messages' | 'notifications' | 'profile' | 'site-config' | 'tasks'): void {
    this.sectionChange.emit(section);
  }
}
