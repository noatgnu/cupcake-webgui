import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WailsService } from '../../core/services/wails.service';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-reset.html',
  styleUrl: './password-reset.scss'
})
export class PasswordResetComponent implements OnInit {
  private wails = inject(WailsService);

  users = signal<string[]>([]);
  selectedUser = '';
  newPassword = '';
  confirmPassword = '';

  loading = signal(false);
  resetting = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const userList = await this.wails.listUsers();
      this.users.set(userList);
      if (userList.length > 0) {
        this.selectedUser = userList[0];
      }
    } catch (err) {
      this.error.set(`Failed to load users: ${err}`);
    } finally {
      this.loading.set(false);
    }
  }

  isValid(): boolean {
    if (!this.selectedUser || !this.newPassword || !this.confirmPassword) return false;
    return this.newPassword === this.confirmPassword && this.newPassword.length >= 8;
  }

  async resetPassword(): Promise<void> {
    if (!this.isValid()) {
      if (this.newPassword !== this.confirmPassword) {
        this.error.set('Passwords do not match');
      } else if (this.newPassword.length < 8) {
        this.error.set('Password must be at least 8 characters');
      }
      return;
    }

    this.resetting.set(true);
    this.error.set(null);

    try {
      await this.wails.resetPassword(this.selectedUser, this.newPassword);
      this.success.set(true);
      this.newPassword = '';
      this.confirmPassword = '';
      setTimeout(() => this.success.set(false), 3000);
    } catch (err) {
      this.error.set(`Failed to reset password: ${err}`);
    } finally {
      this.resetting.set(false);
    }
  }

  close(): void {
    this.wails.closePasswordResetWindow();
  }
}
