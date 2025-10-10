import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StorageObject, StorageService } from '@noatgnu/cupcake-macaron';
import { LabGroup, LabGroupService, ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-storage-access-modal',
  imports: [CommonModule],
  templateUrl: './storage-access-modal.html',
  styleUrl: './storage-access-modal.scss'
})
export class StorageAccessModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private storageService = inject(StorageService);
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);

  @Input() storageObject!: StorageObject;

  allLabGroups = signal<LabGroup[]>([]);
  selectedLabGroups = signal<Set<number>>(new Set());
  loading = signal(false);
  saving = signal(false);

  total = signal(0);
  page = signal(1);
  readonly pageSize = 10;
  readonly Math = Math;

  ngOnInit(): void {
    this.loadLabGroups();
    if (this.storageObject.accessLabGroups) {
      this.selectedLabGroups.set(new Set(this.storageObject.accessLabGroups));
    }
  }

  loadLabGroups(): void {
    this.loading.set(true);
    const offset = (this.page() - 1) * this.pageSize;
    this.labGroupService.getLabGroups({ limit: this.pageSize, offset: offset }).subscribe({
      next: (response) => {
        this.allLabGroups.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load lab groups');
        console.error('Error loading lab groups:', err);
        this.loading.set(false);
      }
    });
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadLabGroups();
    }
  }

  nextPage(): void {
    const totalPages = Math.ceil(this.total() / this.pageSize);
    if (this.page() < totalPages) {
      this.page.update(p => p + 1);
      this.loadLabGroups();
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

  isSelected(labGroupId: number): boolean {
    return this.selectedLabGroups().has(labGroupId);
  }

  save(): void {
    this.saving.set(true);
    this.storageService.updateStorageObject(this.storageObject.id, {
      accessLabGroups: Array.from(this.selectedLabGroups())
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
