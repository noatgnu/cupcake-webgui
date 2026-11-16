import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppliancePower } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-power-admin',
  imports: [AppliancePower, AdminNavbar],
  templateUrl: './power-admin.html',
  styleUrl: './power-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PowerAdmin {}
