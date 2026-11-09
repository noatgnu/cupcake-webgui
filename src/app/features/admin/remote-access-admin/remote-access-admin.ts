import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RemoteAccessStatus } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-remote-access-admin',
  imports: [RemoteAccessStatus, AdminNavbar],
  templateUrl: './remote-access-admin.html',
  styleUrl: './remote-access-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RemoteAccessAdmin {}
