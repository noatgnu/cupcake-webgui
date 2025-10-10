import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StoredReagent, ReagentService } from '@noatgnu/cupcake-macaron';
import { LabGroup, LabGroupService, User, UserManagementService, ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-stored-reagent-access-modal',
  imports: [CommonModule],
  templateUrl: './stored-reagent-access-modal.html',
  styleUrl: './stored-reagent-access-modal.scss'
})
export class StoredReagentAccessModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private reagentService = inject(ReagentService);
  private labGroupService = inject(LabGroupService);
  private userManagementService = inject(UserManagementService);
  private toastService = inject(ToastService);

  @Input() storedReagent!: StoredReagent;

  allLabGroups = signal<LabGroup[]>([]);
  allUsers = signal<User[]>([]);
  selectedLabGroups = signal<Set<number>>(new Set());
  selectedUsers = signal<Set<number>>(new Set());
  accessAll = signal(false);
  shareable = signal(false);
  loading = signal(false);
  saving = signal(false);

  activeTab = signal<'labgroups' | 'users'>('labgroups');

  labGroupsTotal = signal(0);
  labGroupsPage = signal(1);
  usersTotal = signal(0);
  usersPage = signal(1);
  readonly pageSize = 10;
  readonly Math = Math;

  ngOnInit(): void {
    this.shareable.set(this.storedReagent.shareable);
    this.accessAll.set(this.storedReagent.accessAll);

    if (this.storedReagent.accessLabGroups) {
      this.selectedLabGroups.set(new Set(this.storedReagent.accessLabGroups));
    }
    if (this.storedReagent.accessUsers) {
      this.selectedUsers.set(new Set(this.storedReagent.accessUsers));
    }

    this.loadLabGroups();
    this.loadUsers();
  }

  loadLabGroups(): void {
    this.loading.set(true);
    const offset = (this.labGroupsPage() - 1) * this.pageSize;
    this.labGroupService.getLabGroups({ limit: this.pageSize, offset: offset }).subscribe({
      next: (response) => {
        this.allLabGroups.set(response.results);
        this.labGroupsTotal.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load lab groups');
        console.error('Error loading lab groups:', err);
        this.loading.set(false);
      }
    });
  }

  loadUsers(): void {
    this.loading.set(true);
    const offset = (this.usersPage() - 1) * this.pageSize;
    this.userManagementService.getUsers({ limit: this.pageSize, offset: offset }).subscribe({
      next: (response: { results: User[], count: number }) => {
        this.allUsers.set(response.results);
        this.usersTotal.set(response.count);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.toastService.error('Failed to load users');
        console.error('Error loading users:', err);
        this.loading.set(false);
      }
    });
  }

  previousLabGroupsPage(): void {
    if (this.labGroupsPage() > 1) {
      this.labGroupsPage.update(p => p - 1);
      this.loadLabGroups();
    }
  }

  nextLabGroupsPage(): void {
    const totalPages = Math.ceil(this.labGroupsTotal() / this.pageSize);
    if (this.labGroupsPage() < totalPages) {
      this.labGroupsPage.update(p => p + 1);
      this.loadLabGroups();
    }
  }

  previousUsersPage(): void {
    if (this.usersPage() > 1) {
      this.usersPage.update(p => p - 1);
      this.loadUsers();
    }
  }

  nextUsersPage(): void {
    const totalPages = Math.ceil(this.usersTotal() / this.pageSize);
    if (this.usersPage() < totalPages) {
      this.usersPage.update(p => p + 1);
      this.loadUsers();
    }
  }

  toggleLabGroup(labGroupId: number): void {
    const selected = new Set(this.selectedLabGroups());
    if (selected.has(labGroupId)) {
      selected.delete(labGroupId);
    } else {
      selected.add(labGroupId);
    }
    this.selectedLabGroups.set(selected);
  }

  toggleUser(userId: number): void {
    const selected = new Set(this.selectedUsers());
    if (selected.has(userId)) {
      selected.delete(userId);
    } else {
      selected.add(userId);
    }
    this.selectedUsers.set(selected);
  }

  isLabGroupSelected(labGroupId: number): boolean {
    return this.selectedLabGroups().has(labGroupId);
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUsers().has(userId);
  }

  toggleAccessAll(): void {
    this.accessAll.set(!this.accessAll());
    if (this.accessAll()) {
      this.selectedLabGroups.set(new Set());
      this.selectedUsers.set(new Set());
    }
  }

  toggleShareable(): void {
    this.shareable.set(!this.shareable());
    if (!this.shareable()) {
      this.accessAll.set(false);
      this.selectedLabGroups.set(new Set());
      this.selectedUsers.set(new Set());
    }
  }

  save(): void {
    this.saving.set(true);
    this.reagentService.updateStoredReagent(this.storedReagent.id, {
      shareable: this.shareable(),
      accessAll: this.accessAll(),
      accessLabGroups: Array.from(this.selectedLabGroups()),
      accessUsers: Array.from(this.selectedUsers())
    }).subscribe({
      next: () => {
        this.toastService.success('Access permissions updated');
        this.activeModal.close(true);
      },
      error: (err) => {
        this.toastService.error('Failed to update access permissions');
        console.error('Error updating access permissions:', err);
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
