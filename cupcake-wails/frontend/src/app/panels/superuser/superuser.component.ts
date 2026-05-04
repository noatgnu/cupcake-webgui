import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WailsService } from '../../core/services/wails.service';

@Component({
  selector: 'app-superuser',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superuser.component.html',
  styleUrl: './superuser.component.scss'
})
export class SuperuserComponent {
  private wails = inject(WailsService);

  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  creating = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  isValid(): boolean {
    if (!this.username || !this.email || !this.password || !this.confirmPassword) return false;
    return this.password === this.confirmPassword && this.password.length >= 8;
  }

  async create(): Promise<void> {
    if (!this.isValid()) {
      this.error.set(this.password !== this.confirmPassword ? 'Passwords do not match' : 'Password too short');
      return;
    }

    this.creating.set(true);
    this.error.set(null);

    try {
      await this.wails.createSuperuser(this.username, this.email, this.password);
      this.success.set(true);
      setTimeout(() => this.wails.dismissSuperuserCreation(), 1500);
    } catch (err) {
      this.error.set(`Provisioning failed: ${err}`);
    } finally {
      this.creating.set(false);
    }
  }

  skip(): void { this.wails.dismissSuperuserCreation(); }
}
