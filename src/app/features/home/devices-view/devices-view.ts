import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { DeviceTokenManagement } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-devices-view',
  imports: [DeviceTokenManagement],
  templateUrl: './devices-view.html',
  styleUrl: './devices-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesView {
  @ViewChild(DeviceTokenManagement) deviceTokenManager!: DeviceTokenManagement;

  openCreate(): void {
    this.deviceTokenManager.openCreate();
  }
}
