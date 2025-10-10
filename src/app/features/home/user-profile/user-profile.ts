import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, ToastService, User, UserManagementService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-user-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss'
})
export class UserProfile implements OnInit {
  private authService = inject(AuthService);
  private userManagementService = inject(UserManagementService);
  private toastService = inject(ToastService);

  currentUser = signal<User | null>(null);
  editMode = signal(false);
  changePasswordMode = signal(false);

  firstName = '';
  lastName = '';
  email = '';

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  saving = signal(false);
  changingPassword = signal(false);

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);
    if (user) {
      this.firstName = user.firstName || '';
      this.lastName = user.lastName || '';
      this.email = user.email || '';
    }

    this.authService.currentUser$.subscribe(updatedUser => {
      this.currentUser.set(updatedUser);
      if (updatedUser) {
        this.firstName = updatedUser.firstName || '';
        this.lastName = updatedUser.lastName || '';
        this.email = updatedUser.email || '';
      }
    });
  }

  toggleEditMode(): void {
    if (this.editMode()) {
      const user = this.currentUser();
      if (user) {
        this.firstName = user.firstName || '';
        this.lastName = user.lastName || '';
        this.email = user.email || '';
      }
    }
    this.editMode.set(!this.editMode());
  }

  toggleChangePasswordMode(): void {
    if (this.changePasswordMode()) {
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }
    this.changePasswordMode.set(!this.changePasswordMode());
  }

  saveProfile(): void {
    const user = this.currentUser();
    if (!user) return;

    if (!this.email.trim()) {
      this.toastService.error('Email is required');
      return;
    }

    if (!this.currentPassword) {
      this.toastService.error('Current password is required to update profile');
      return;
    }

    this.saving.set(true);
    this.userManagementService.updateProfile({
      firstName: this.firstName.trim() || undefined,
      lastName: this.lastName.trim() || undefined,
      email: this.email.trim(),
      currentPassword: this.currentPassword
    }).subscribe({
      next: (response) => {
        this.toastService.success('Profile updated successfully');
        this.currentUser.set(response.user);
        this.currentPassword = '';
        this.saving.set(false);
        this.editMode.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to update profile');
        console.error('Error updating profile:', err);
        this.saving.set(false);
      }
    });
  }

  changePassword(): void {
    if (!this.currentPassword) {
      this.toastService.error('Current password is required');
      return;
    }

    if (!this.newPassword) {
      this.toastService.error('New password is required');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.toastService.error('Passwords do not match');
      return;
    }

    if (this.newPassword.length < 8) {
      this.toastService.error('Password must be at least 8 characters');
      return;
    }

    this.changingPassword.set(true);
    this.userManagementService.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: () => {
        this.toastService.success('Password changed successfully');
        this.changingPassword.set(false);
        this.changePasswordMode.set(false);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.toastService.error('Failed to change password');
        console.error('Error changing password:', err);
        this.changingPassword.set(false);
      }
    });
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    if (!user) return '';
    return this.userManagementService.getUserDisplayName(user);
  }

  formatDate(dateString?: string): string {
    return this.userManagementService.formatDate(dateString);
  }
}
