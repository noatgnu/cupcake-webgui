import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WailsService, DownloadProgress } from '../../core/services/wails.service';

type SetupPhase = 'check' | 'download-backend' | 'python-select' | 'download-valkey' | 'services' | 'complete';

interface PhaseInfo {
  id: SetupPhase;
  name: string;
  description: string;
}

@Component({
  selector: 'app-backend-setup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backend-setup.component.html',
  styleUrl: './backend-setup.component.scss'
})
export class BackendSetupComponent {
  private wails = inject(WailsService);

  phases: PhaseInfo[] = [
    { id: 'check', name: 'Identity Validation', description: 'Checking architecture' },
    { id: 'download-backend', name: 'Core Distribution', description: 'Fetching application binaries' },
    { id: 'python-select', name: 'Runtime Linking', description: 'Configuring Python bridge' },
    { id: 'download-valkey', name: 'Service Layer', description: 'Provisioning cache server' },
    { id: 'services', name: 'Bootstrapping', description: 'Starting background workers' },
    { id: 'complete', name: 'System Ready', description: 'Environment established' },
  ];

  currentPhase = signal<SetupPhase>('check');
  completedPhases = signal<SetupPhase[]>([]);
  downloadProgress = signal<DownloadProgress | null>(null);
  statusMessage = signal('Orchestrating...');
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const progress = this.wails.downloadProgress();
      if (progress) this.downloadProgress.set(progress);
    });

    effect(() => {
      const status = this.wails.backendStatus();
      if (status) {
        this.statusMessage.set(status.message);
        if (status.status === 'error') this.error.set(status.message);
      }
    });
  }

  isPhaseCompleted(phase: SetupPhase): boolean {
    return this.completedPhases().includes(phase);
  }

  formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec === 0) return '0 B/s';
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
    return (bytesPerSec / Math.pow(1024, i)).toFixed(1) + ' ' + ['B/s', 'KB/s', 'MB/s', 'GB/s'][i];
  }

  retry(): void { this.error.set(null); }
}
