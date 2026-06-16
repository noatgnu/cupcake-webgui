import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { UserManagementService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-user-create-modal',
  imports: [FormsModule],
  templateUrl: './user-create-modal.html',
  styleUrl: './user-create-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
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
  saving = signal(false);

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

    this.saving.set(true);
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
        this.saving.set(false);
        this.activeModal.close(response.user);
      },
      error: (err) => {
        this.toastService.error('Failed to create user');
        this.saving.set(false);
      }
    });
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
