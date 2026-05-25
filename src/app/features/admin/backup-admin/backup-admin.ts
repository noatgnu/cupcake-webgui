import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BackupManagement } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-backup-admin',
  imports: [BackupManagement, AdminNavbar],
  templateUrl: './backup-admin.html',
  styleUrl: './backup-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackupAdmin {}
