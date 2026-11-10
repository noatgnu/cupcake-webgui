import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PluginManagement } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-plugin-admin',
  imports: [PluginManagement, AdminNavbar],
  templateUrl: './plugin-admin.html',
  styleUrl: './plugin-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginAdmin {}
