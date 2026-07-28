import { Component, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { StorageList } from '../storage-list/storage-list';
import { StorageNavbar } from '../storage-navbar/storage-navbar';

@Component({
  selector: 'app-storage',
  imports: [StorageList, StorageNavbar],
  templateUrl: './storage.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './storage.scss'
})
export class Storage {
  @ViewChild(StorageList) storageList?: StorageList;

  openCreateModal(): void {
    this.storageList?.openCreateModal();
  }
}
