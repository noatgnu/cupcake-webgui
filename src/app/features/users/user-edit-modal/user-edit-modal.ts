import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { User, ToastService } from '@noatgnu/cupcake-core';
import { UserManagementService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-user-edit-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-edit-modal.html',
  styleUrl: './user-edit-modal.scss'
})
export class UserEditModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private userManagementService = inject(UserManagementService);
  private toastService = inject(ToastService);

  @Input() user!: User;

  username = '';
  email = '';
  firstName = '';
  lastName = '';
  isStaff = false;
  isSuperuser = false;
  isActive = true;
  saving = false;

  ngOnInit(): void {
    this.username = this.user.username;
    this.email = this.user.email;
    this.firstName = this.user.firstName || '';
    this.lastName = this.user.lastName || '';
    this.isStaff = this.user.isStaff;
    this.isSuperuser = this.user.isSuperuser;
    this.isActive = this.user.isActive;
  }

  save(): void {
    if (!this.username.trim()) {
      this.toastService.error('Username is required');
      return;
    }

    if (!this.email.trim()) {
      this.toastService.error('Email is required');
      return;
    }

    this.saving = true;
    this.userManagementService.updateUser(this.user.id, {
      username: this.username.trim(),
      email: this.email.trim(),
      firstName: this.firstName.trim() || undefined,
      lastName: this.lastName.trim() || undefined,
      isStaff: this.isStaff,
      isSuperuser: this.isSuperuser,
      isActive: this.isActive
    }).subscribe({
      next: (updated) => {
        this.toastService.success('User updated successfully');
        this.saving = false;
        this.activeModal.close(updated);
      },
      error: (err) => {
        this.toastService.error('Failed to update user');
        console.error('Error updating user:', err);
        this.saving = false;
      }
    });
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
