import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';
import { Observable } from 'rxjs';

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
  imports: [FormsModule],
  templateUrl: './lab-group-invite-modal.html',
  styleUrl: './lab-group-invite-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabGroupInviteModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private userManagementService = inject(UserManagementService);

  @Input() labGroup!: LabGroup;

  users = signal<User[]>([]);
  selectedUser: User | null = null;
  searchQuery = '';
  loading = signal(false);
  saving = signal(false);
  isStaff = false;

  ngOnInit(): void {
    const user = this.authService.currentUser();
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

    const request: Observable<unknown> = this.isStaff
      ? this.labGroupService.addMemberToLabGroup(this.labGroup.id, this.selectedUser.id)
      : this.labGroupService.inviteUserToLabGroup(this.labGroup.id, {
          labGroup: this.labGroup.id,
          invitedEmail: this.selectedUser.email
        });
    request.subscribe({
      next: () => {
        this.toastService.success(this.isStaff ? 'User added to lab group' : 'Invitation sent');
        this.saving.set(false);
        this.activeModal.close(true);
      },
      error: () => {
        this.toastService.error(this.isStaff ? 'Failed to add the user' : 'Failed to send invitation');
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
