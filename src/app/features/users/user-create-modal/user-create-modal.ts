import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { UserManagementService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-user-create-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-create-modal.html',
  styleUrl: './user-create-modal.scss'
})
export class UserCreateModal {
  private activeModal = inject(NgbActiveModal);
  private userManagementService = inject(UserManagementService);
  private toastService = inject(ToastService);

  username = '';
  email = '';
  firstName = '';
  lastName = '';
  password = '';
  passwordConfirm = '';
  isStaff = false;
  isSuperuser = false;
  isActive = true;
  saving = false;

  save(): void {
    if (!this.username.trim()) {
      this.toastService.error('Username is required');
      return;
    }

    if (!this.email.trim()) {
      this.toastService.error('Email is required');
      return;
    }

    if (!this.password) {
      this.toastService.error('Password is required');
      return;
    }

    if (this.password !== this.passwordConfirm) {
      this.toastService.error('Passwords do not match');
      return;
    }

    this.saving = true;
    this.userManagementService.createUser({
      username: this.username.trim(),
      email: this.email.trim(),
      firstName: this.firstName.trim() || undefined,
      lastName: this.lastName.trim() || undefined,
      password: this.password,
      passwordConfirm: this.passwordConfirm,
      isStaff: this.isStaff,
      isSuperuser: this.isSuperuser,
      isActive: this.isActive
    }).subscribe({
      next: (response) => {
        this.toastService.success('User created successfully');
        this.saving = false;
        this.activeModal.close(response.user);
      },
      error: (err) => {
        this.toastService.error('Failed to create user');
        console.error('Error creating user:', err);
        this.saving = false;
      }
    });
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
