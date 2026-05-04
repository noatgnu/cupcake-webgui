import { Component, OnInit, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WailsService, ReleaseInfo, DownloadProgress, PythonCandidate } from '../../core/services/wails.service';

type DistributionMode = 'portable' | 'native';

@Component({
  selector: 'app-downloader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './downloader.component.html',
  styleUrl: './downloader.component.scss'
})
export class DownloaderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private wails = inject(WailsService);

  downloadType: 'backend' | 'valkey' = 'backend';
  distributionMode = signal<DistributionMode>('portable');

  title = computed(() => {
    return this.downloadType === 'backend'
      ? 'Backend Source'
      : 'Service Setup';
  });

  description = computed(() => {
    if (this.downloadType !== 'backend') {
      return 'Initializing Redis/Valkey for asynchronous background processing';
    }
    return this.distributionMode() === 'portable'
      ? 'Standalone package with pre-configured Python environment'
      : 'Developer mode: Synchronize repository and use system-level Python';
  });

  loadingReleases = signal(false);
  releases = signal<ReleaseInfo[]>([]);
  selectedVersion = signal<string>('');
  selectedBranch = signal<string>('');

  loadingPython = signal(false);
  pythonCandidates = signal<PythonCandidate[]>([]);
  selectedPython = signal<string>('');

  downloading = signal(false);
  progress = signal<DownloadProgress | null>(null);
  statusMessage = signal('');

  error = signal<string | null>(null);
  success = signal(false);
  successMessage = signal('');

  progressTitle = computed(() => {
    if (this.downloadType === 'valkey') return 'Downloading Core Service';
    return this.distributionMode() === 'portable'
      ? 'Downloading Distribution'
      : 'Orchestrating Environment';
  });

  downloadButtonLabel = computed(() => {
    if (this.downloadType === 'valkey') return 'Begin Download';
    return this.distributionMode() === 'portable' ? 'Begin Download' : 'Start Orchestration';
  });

  canDownload = computed(() => {
    if (this.downloading() || this.success()) return false;
    if (this.downloadType === 'valkey') return true;

    if (this.distributionMode() === 'portable') {
      return this.selectedVersion() !== '';
    } else {
      return this.selectedBranch() !== '' && this.selectedPython() !== '';
    }
  });

  constructor() {
    effect(() => {
      const progress = this.wails.downloadProgress();
      if (progress) {
        this.progress.set(progress);
        if (progress.downloaded > 0 && progress.total > 0) {
          this.statusMessage.set('Downloading...');
        } else if (progress.downloaded > 0) {
          this.statusMessage.set('Receiving data...');
        }
      }
    });

    effect(() => {
      const complete = this.wails.downloadComplete();
      if (complete) {
        this.downloading.set(false);
        if (complete.success) {
          this.success.set(true);
          this.successMessage.set(complete.message);
          this.statusMessage.set('Complete');
        } else {
          this.error.set(complete.message);
          this.statusMessage.set('Failed');
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const queryType = this.route.snapshot.queryParams['type'];
    const routeType = this.route.snapshot.data['downloadType'];

    this.downloadType = (queryType === 'valkey' || routeType === 'valkey') ? 'valkey' : 'backend';

    if (this.downloadType === 'backend') {
      await Promise.all([this.loadReleases(), this.loadPythonCandidates()]);
    }
  }

  setDistributionMode(mode: DistributionMode): void {
    this.distributionMode.set(mode);
    this.error.set(null);
  }

  async loadReleases(): Promise<void> {
    this.loadingReleases.set(true);
    try {
      const releases = await this.wails.getAvailableReleases();
      this.releases.set(releases);
      if (releases.length > 0) {
        this.selectedVersion.set(releases[0].tag);
        this.selectedBranch.set(releases[0].tag);
      }
    } catch (error) {
      this.error.set(`Release API error: ${error}`);
    } finally {
      this.loadingReleases.set(false);
    }
  }

  async loadPythonCandidates(): Promise<void> {
    this.loadingPython.set(true);
    try {
      const candidates = await this.wails.detectPythonCandidates();
      this.pythonCandidates.set(candidates);
      if (candidates.length > 0) this.selectedPython.set(candidates[0].path);
    } catch (error) {
      this.error.set(`Python detection error: ${error}`);
    } finally {
      this.loadingPython.set(false);
    }
  }

  selectVersion(tag: string): void { this.selectedVersion.set(tag); }
  selectBranch(tag: string): void { this.selectedBranch.set(tag); }
  selectPython(candidate: PythonCandidate): void { this.selectedPython.set(candidate.path); }

  async startDownload(): Promise<void> {
    this.downloading.set(true);
    this.error.set(null);
    this.statusMessage.set(this.distributionMode() === 'native' ? 'Provisioning repository...' : 'Negotiating connection...');

    try {
      if (this.downloadType === 'backend') {
        if (this.distributionMode() === 'portable') {
          await this.wails.downloadPortableBackend(this.selectedVersion());
        } else {
          await this.wails.setupNativeBackend(this.selectedPython(), this.selectedBranch());
        }
      } else {
        await this.wails.downloadValkey();
      }
    } catch (error) {
      this.downloading.set(false);
      this.error.set(`Provisioning failed: ${error}`);
    }
  }

  formatDate(dateStr: string): string {
    return dateStr ? new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  }

  formatSpeed(bytesPerSec: number): string { return this.formatSize(bytesPerSec) + '/s'; }

  close(): void {
    if (this.downloadType === 'valkey') {
      this.wails.dismissValkeyDownload();
    } else {
      this.wails.dismissBackendDownload();
    }
  }
}
