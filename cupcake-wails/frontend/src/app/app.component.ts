import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { WailsService } from './core/services/wails.service';
import { SuperuserComponent } from './panels/superuser/superuser.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SuperuserComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly wails = inject(WailsService);
  showSuperuserModal = this.wails.showSuperuserCreation;

  constructor() {
    effect(() => {
      const status = this.wails.backendStatus();
      if (status) {
        this.wails.logToFile(`Backend status: ${status.service} - ${status.status}: ${status.message}`);
      }
    });
  }
}
