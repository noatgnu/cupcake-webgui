import { Component, ChangeDetectionStrategy } from '@angular/core';
import { StorageManagement } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-storage-admin',
  imports: [StorageManagement, AdminNavbar],
  templateUrl: './storage-admin.html',
  styleUrl: './storage-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorageAdmin {}
