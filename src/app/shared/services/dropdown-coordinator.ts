import { Injectable, signal } from '@angular/core';

export type DropdownType = 'notification' | 'messaging' | 'async-task' | null;

@Injectable({
  providedIn: 'root'
})
export class DropdownCoordinator {
  private activeDropdown = signal<DropdownType>(null);

  getActiveDropdown() {
    return this.activeDropdown();
  }

  openDropdown(type: DropdownType): void {
    this.activeDropdown.set(type);
  }

  closeDropdown(type: DropdownType): void {
    if (this.activeDropdown() === type) {
      this.activeDropdown.set(null);
    }
  }

  isDropdownOpen(type: DropdownType): boolean {
    return this.activeDropdown() === type;
  }
}
