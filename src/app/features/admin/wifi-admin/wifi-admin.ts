import { Component, ChangeDetectionStrategy } from '@angular/core';
import { WifiManagement } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-wifi-admin',
  imports: [WifiManagement, AdminNavbar],
  templateUrl: './wifi-admin.html',
  styleUrl: './wifi-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WifiAdmin {}
