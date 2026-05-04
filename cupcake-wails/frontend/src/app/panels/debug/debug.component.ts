import { Component, signal, computed, effect, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WailsService, LogMessage } from '../../core/services/wails.service';

@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './debug.component.html',
  styleUrl: './debug.component.scss'
})
export class DebugComponent {
  @ViewChild('terminalViewport') private terminalViewport!: ElementRef;
  private wails = inject(WailsService);

  filterLevel = 'all';
  autoScroll = true;

  private logs = signal<{message: string; type: string; time: string}[]>([]);
  logCount = computed(() => this.logs().length);

  filteredLogs = computed(() => {
    const logs = this.logs();
    return this.filterLevel === 'all' ? logs : logs.filter(log => log.type === this.filterLevel);
  });

  backendStatus = signal('Initializing');
  isLastError = signal(false);

  constructor() {
    effect(() => {
      const log = this.wails.backendLog();
      if (log) this.addLog(log);
    });

    effect(() => {
      const status = this.wails.backendStatus();
      if (status) {
        this.backendStatus.set(`${status.service}: ${status.status}`);
        this.isLastError.set(status.status === 'error');
        this.addLog({
          message: `[${status.service}] ${status.message}`,
          type: status.status === 'error' ? 'error' : 'info'
        });
      }
    });
  }

  private addLog(log: LogMessage): void {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logs.update(current => {
      const updated = [...current, { ...log, time }];
      return updated.length > 2000 ? updated.slice(-2000) : updated;
    });

    if (this.autoScroll) {
      setTimeout(() => this.scrollToBottom(), 10);
    }
  }

  private scrollToBottom(): void {
    if (this.terminalViewport) {
      const el = this.terminalViewport.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  clearLogs(): void {
    this.logs.set([]);
  }
}
