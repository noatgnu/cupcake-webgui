import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { LabGroup, LabGroupService, ToastService, AuthService, User, LabGroupMember, LabGroupPathItem } from '@noatgnu/cupcake-core';
import { LabGroupPermissionsModal } from '../lab-group-permissions-modal/lab-group-permissions-modal';
import { LabGroupEditModal } from '../lab-group-edit-modal/lab-group-edit-modal';
import { LabGroupInviteModal } from '../lab-group-invite-modal/lab-group-invite-modal';
import { LabGroupCreateModal } from '../lab-group-create-modal/lab-group-create-modal';

@Component({
  selector: 'app-lab-group-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './lab-group-list.html',
  styleUrl: './lab-group-list.scss'
})
export class LabGroupList implements OnInit {
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);

  currentUser = signal<User | null>(null);
  isStaff = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return user.isStaff === true || (user as any).is_staff === true;
  });

  currentLabGroupId = signal<number | null>(null);
  currentLabGroup = signal<LabGroup | null>(null);
  childLabGroups = signal<LabGroup[]>([]);
  members = signal<LabGroupMember[]>([]);
  breadcrumbs = signal<LabGroupPathItem[]>([]);

  loadingChildren = signal(false);
  loadingMembers = signal(false);
  error = signal<string | null>(null);

  childTotal = signal(0);
  childPage = signal(1);
  searchQuery = '';
  readonly pageSize = 10;

  memberTotal = signal(0);
  memberPage = signal(1);
  directMembersOnly = signal(false);
  readonly memberPageSize = 10;
  readonly Math = Math;

  hasGroupAccess(labGroup: LabGroup): boolean {
    return this.isStaff() || !!(labGroup.canManage || labGroup.canInvite || labGroup.isMember || labGroup.isCreator);
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);

    this.authService.currentUser$.subscribe(updatedUser => {
      this.currentUser.set(updatedUser);
    });

    this.loadChildLabGroups();
  }

  loadChildLabGroups(): void {
    this.loadingChildren.set(true);
    this.error.set(null);

    const offset = (this.childPage() - 1) * this.pageSize;
    const params: any = {
      limit: this.pageSize,
      offset: offset
    };

    if (this.searchQuery) {
      params.search = this.searchQuery;
    }

    const currentId = this.currentLabGroupId();
    if (currentId) {
      params.parentGroup = currentId;
    } else {
      params.parentGroup__isnull = 'true';
    }

    this.labGroupService.getLabGroups(params).subscribe({
      next: (response) => {
        this.childLabGroups.set(response.results);
        this.childTotal.set(response.count);
        this.loadingChildren.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load lab groups');
        this.loadingChildren.set(false);
        console.error('Error loading lab groups:', err);
      }
    });
  }

  loadBreadcrumbs(): void {
    const group = this.currentLabGroup();
    if (group && group.fullPath && group.fullPath.length > 0) {
      this.breadcrumbs.set(group.fullPath);
    } else {
      this.breadcrumbs.set([]);
    }
  }

  loadMembers(): void {
    const group = this.currentLabGroup();
    if (!group) {
      this.members.set([]);
      this.memberTotal.set(0);
      return;
    }

    if (!this.hasGroupAccess(group)) {
      this.members.set([]);
      this.memberTotal.set(0);
      return;
    }

    this.loadingMembers.set(true);
    const offset = (this.memberPage() - 1) * this.memberPageSize;
    this.labGroupService.getLabGroupMembers(group.id, {
      directOnly: this.directMembersOnly(),
      limit: this.memberPageSize,
      offset: offset
    }).subscribe({
      next: (response) => {
        this.members.set(response.results);
        this.memberTotal.set(response.count);
        this.loadingMembers.set(false);
      },
      error: (err) => {
        if (err.status !== 403) {
          console.error('Error loading members:', err);
        }
        this.members.set([]);
        this.memberTotal.set(0);
        this.loadingMembers.set(false);
      }
    });
  }

  navigateToLabGroup(labGroup: LabGroup): void {
    this.currentLabGroupId.set(labGroup.id);
    this.currentLabGroup.set(labGroup);
    this.childPage.set(1);
    this.memberPage.set(1);
    this.loadChildLabGroups();
    this.loadBreadcrumbs();
    this.loadMembers();
  }

  navigateToRoot(): void {
    this.currentLabGroupId.set(null);
    this.currentLabGroup.set(null);
    this.members.set([]);
    this.memberTotal.set(0);
    this.breadcrumbs.set([]);
    this.childPage.set(1);
    this.memberPage.set(1);
    this.loadChildLabGroups();
  }

  navigateToBreadcrumb(item: LabGroupPathItem): void {
    const currentBreadcrumbs = this.breadcrumbs();
    const targetIndex = currentBreadcrumbs.findIndex(crumb => crumb.id === item.id);

    if (targetIndex >= 0) {
      const newBreadcrumbs = currentBreadcrumbs.slice(0, targetIndex + 1);
      const childGroups = this.childLabGroups();
      const foundGroup = childGroups.find(g => g.id === item.id);

      if (foundGroup) {
        this.navigateToLabGroup(foundGroup);
      } else {
        this.currentLabGroupId.set(item.id);
        this.breadcrumbs.set(newBreadcrumbs);
        this.childPage.set(1);
        this.loadChildLabGroups();
      }
    }
  }

  handleLabGroupClick(labGroup: LabGroup): void {
    if (!this.hasGroupAccess(labGroup)) {
      this.toastService.error('You do not have permission to access this group');
      return;
    }
    this.navigateToLabGroup(labGroup);
  }

  onSearchChange(): void {
    this.childPage.set(1);
    this.loadChildLabGroups();
  }

  previousChildPage(): void {
    if (this.childPage() > 1) {
      this.childPage.update(p => p - 1);
      this.loadChildLabGroups();
    }
  }

  nextChildPage(): void {
    if (this.childPage() * this.pageSize < this.childTotal()) {
      this.childPage.update(p => p + 1);
      this.loadChildLabGroups();
    }
  }

  openPermissionsModal(labGroup: LabGroup): void {
    const modalRef = this.modalService.open(LabGroupPermissionsModal, {
      size: 'lg',
      backdrop: 'static'
    });
    modalRef.componentInstance.labGroup = labGroup;
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadChildLabGroups();
        }
      },
      () => {}
    );
  }

  openEditModal(labGroup: LabGroup): void {
    const modalRef = this.modalService.open(LabGroupEditModal, {
      backdrop: 'static'
    });
    modalRef.componentInstance.labGroup = labGroup;
    modalRef.result.then(
      (result) => {
        if (result) {
          const groups = this.childLabGroups();
          const index = groups.findIndex(g => g.id === result.id);
          if (index !== -1) {
            groups[index] = result;
            this.childLabGroups.set([...groups]);
          }
          if (this.currentLabGroup()?.id === result.id) {
            this.currentLabGroup.set(result);
          }
        }
      },
      () => {}
    );
  }

  openInviteModal(labGroup: LabGroup): void {
    const modalRef = this.modalService.open(LabGroupInviteModal, {
      backdrop: 'static'
    });
    modalRef.componentInstance.labGroup = labGroup;
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadMembers();
        }
      },
      () => {}
    );
  }

  openCreateModal(parentGroup?: LabGroup): void {
    const modalRef = this.modalService.open(LabGroupCreateModal, {
      backdrop: 'static'
    });
    if (parentGroup) {
      modalRef.componentInstance.parentGroup = parentGroup;
    }
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadChildLabGroups();
        }
      },
      () => {}
    );
  }

  toggleDirectMembersOnly(): void {
    this.directMembersOnly.update(v => !v);
    this.memberPage.set(1);
    this.loadMembers();
  }

  previousMemberPage(): void {
    if (this.memberPage() > 1) {
      this.memberPage.update(p => p - 1);
      this.loadMembers();
    }
  }

  nextMemberPage(): void {
    const totalPages = Math.ceil(this.memberTotal() / this.memberPageSize);
    if (this.memberPage() < totalPages) {
      this.memberPage.update(p => p + 1);
      this.loadMembers();
    }
  }
}
