import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  LabGroup,
  LabGroupService,
  ToastService,
  AuthService,
  User
} from '@noatgnu/cupcake-core';
import { UserManagementService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-lab-group-invite-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './lab-group-invite-modal.html',
  styleUrl: './lab-group-invite-modal.scss'
})
export class LabGroupInviteModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private userManagementService = inject(UserManagementService);

  @Input() labGroup!: LabGroup;

  currentUser$ = this.authService.currentUser$;
  users = signal<User[]>([]);
  selectedUser: User | null = null;
  searchQuery = '';
  loading = signal(false);
  saving = signal(false);
  isStaff = false;

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.isStaff = user?.isStaff || false;
    this.searchUsers();
  }

  searchUsers(): void {
    this.loading.set(true);
    this.userManagementService.getUsers({
      search: this.searchQuery,
      isActive: true,
      limit: 10,
      offset: 0
    }).subscribe({
      next: (response) => {
        this.users.set(response.results);
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load users');
        console.error('Error loading users:', err);
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.searchUsers();
  }

  inviteOrAddUser(): void {
    if (!this.selectedUser) {
      this.toastService.error('Please select a user');
      return;
    }

    this.saving.set(true);

    this.labGroupService.inviteUserToLabGroup(this.labGroup.id, {
      labGroup: this.labGroup.id,
      invitedEmail: this.selectedUser.email
    }).subscribe({
      next: () => {
        if (this.isStaff) {
          this.toastService.success('User added to lab group successfully');
        } else {
          this.toastService.success('Invitation sent successfully');
        }
        this.saving.set(false);
        this.activeModal.close(true);
      },
      error: (err) => {
        this.toastService.error('Failed to send invitation');
        console.error('Error sending invitation:', err);
        this.saving.set(false);
      }
    });
  }

  getUserDisplayName(user: User): string {
    return this.userManagementService.getUserDisplayName(user);
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
