import { Component, OnInit, OnDestroy, computed, signal, effect, untracked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WailsService, BackendStatus, LogMessage } from '../../core/services/wails.service';

interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'pending' | 'starting' | 'ready' | 'error';
  message: string;
}

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.scss'
})
export class SplashComponent implements OnInit, OnDestroy {
  @ViewChild('logContainer') private logContainer!: ElementRef;
  version = '0.0.1';
  currentTime = new Date();
  private timer: any;

  private serviceStatuses = signal<Map<string, ServiceStatus>>(new Map([
    ['database', { name: 'database', displayName: 'Database', status: 'pending', message: 'Waiting...' }],
    ['python', { name: 'python', displayName: 'Python', status: 'pending', message: 'Waiting...' }],
    ['venv', { name: 'venv', displayName: 'Virtual Environment', status: 'pending', message: 'Waiting...' }],
    ['dependencies', { name: 'dependencies', displayName: 'Dependencies', status: 'pending', message: 'Waiting...' }],
    ['migrations', { name: 'migrations', displayName: 'Migrations', status: 'pending', message: 'Waiting...' }],
    ['collectstatic', { name: 'collectstatic', displayName: 'Static Files', status: 'pending', message: 'Waiting...' }],
    ['redis', { name: 'redis', displayName: 'Redis Server', status: 'pending', message: 'Waiting...' }],
    ['django', { name: 'django', displayName: 'Django Server', status: 'pending', message: 'Waiting...' }],
    ['rq', { name: 'rq', displayName: 'RQ Worker', status: 'pending', message: 'Waiting...' }],
  ]));

  services = computed(() => Array.from(this.serviceStatuses().values()));

  private logs = signal<LogMessage[]>([]);
  recentLogs = computed(() => this.logs().slice(-50));

  constructor(private wails: WailsService) {
    effect(() => {
      const status = this.wails.backendStatus();
      if (status) {
        this.updateServiceStatus(status);
      }
    });

    effect(() => {
      const log = this.wails.backendLog();
      if (log) {
        this.addLog(log);
        setTimeout(() => this.scrollToBottom(), 10);
      }
    });
  }

  ngOnInit(): void {
    this.wails.getAppVersion().then(version => {
      this.version = version;
    });

    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private scrollToBottom(): void {
    if (this.logContainer) {
      const element = this.logContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private updateServiceStatus(status: BackendStatus): void {
    const currentStatuses = untracked(() => this.serviceStatuses());
    const statuses = new Map(currentStatuses);
    const current = statuses.get(status.service);
    if (current) {
      statuses.set(status.service, {
        ...current,
        status: status.status as 'pending' | 'starting' | 'ready' | 'error',
        message: status.message
      });
      this.serviceStatuses.set(statuses);
    }
  }

  private addLog(log: LogMessage): void {
    const current = untracked(() => this.logs());
    this.logs.set([...current, log]);
  }
}
