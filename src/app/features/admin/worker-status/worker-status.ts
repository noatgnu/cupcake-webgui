import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SiteConfigService, ToastService, AuthService } from '@noatgnu/cupcake-core';
import type { WorkerStatusResponse, Worker, QueueStats } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-worker-status',
  imports: [CommonModule, AdminNavbar],
  templateUrl: './worker-status.html',
  styleUrl: './worker-status.scss',
})
export class WorkerStatus implements OnInit {
  private siteConfigService = inject(SiteConfigService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  workerStatus = signal<WorkerStatusResponse | null>(null);
  loading = signal(false);
  canView = signal(false);

  Object = Object;

  ngOnInit(): void {
    this.checkPermissions();
    if (this.canView()) {
      this.loadWorkerStatus();
    }
  }

  checkPermissions(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user && user.isSuperuser) {
        this.canView.set(true);
      } else {
        this.canView.set(false);
      }
    });
  }

  loadWorkerStatus(): void {
    this.loading.set(true);
    this.siteConfigService.getWorkerStatus().subscribe({
      next: (response: WorkerStatusResponse) => {
        this.workerStatus.set(response);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Error loading worker status:', err);
        this.toastService.error('Failed to load worker status');
        this.loading.set(false);
      }
    });
  }

  refreshStatus(): void {
    this.loadWorkerStatus();
  }

  getWorkerStateBadgeClass(state: string): string {
    const stateClasses: { [key: string]: string } = {
      'idle': 'bg-secondary',
      'busy': 'bg-primary',
      'suspended': 'bg-warning',
      'dead': 'bg-danger'
    };
    return stateClasses[state] || 'bg-secondary';
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
}
