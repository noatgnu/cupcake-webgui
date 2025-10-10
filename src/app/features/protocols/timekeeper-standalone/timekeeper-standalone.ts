import { Component, inject, OnInit, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeKeeperService, SessionService, ProtocolStepService, TimeKeeperWebSocketService } from '@noatgnu/cupcake-red-velvet';
import type { TimeKeeper, Session, ProtocolStep, TimeKeeperEvent } from '@noatgnu/cupcake-red-velvet';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { TimerService } from '../../../shared/services/timer';
import { environment } from '../../../../environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-timekeeper-standalone',
  imports: [CommonModule, FormsModule],
  templateUrl: './timekeeper-standalone.html',
  styleUrl: './timekeeper-standalone.scss'
})
export class TimekeeperStandalone implements OnInit, OnDestroy {
  private timeKeeperService = inject(TimeKeeperService);
  private sessionService = inject(SessionService);
  private protocolStepService = inject(ProtocolStepService);
  private timeKeeperWsService = inject(TimeKeeperWebSocketService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  public timer = inject(TimerService);

  private wsSubscriptions: Subscription[] = [];

  timekeepers = signal<TimeKeeper[]>([]);
  filteredTimekeepers = signal<TimeKeeper[]>([]);
  selectedTimer = signal<TimeKeeper | null>(null);
  selectedTimerSession = signal<Session | null>(null);
  selectedTimerStep = signal<ProtocolStep | null>(null);
  loadingDetails = signal(false);
  loading = signal(false);
  showCreateForm = signal(false);
  filterType = signal<'all' | 'standalone' | 'session'>('all');

  currentPage = signal(1);
  pageSize = 10;
  totalCount = signal(0);
  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize));
  Math = Math;

  standaloneCount = computed(() =>
    this.timekeepers().filter(tk => !tk.session && !tk.step).length
  );
  sessionCount = computed(() =>
    this.timekeepers().filter(tk => tk.session || tk.step).length
  );

  newTimerName = '';
  newTimerDuration = 300;

  ngOnInit(): void {
    this.loadTimekeepers();
    this.initializeWebSocket();
  }

  loadTimekeepers(): void {
    this.loading.set(true);
    const offset = (this.currentPage() - 1) * this.pageSize;
    this.timeKeeperService.getTimeKeepers({ limit: this.pageSize, offset }).subscribe({
      next: (response) => {
        this.totalCount.set(response.count);
        this.timekeepers.set(response.results);
        this.applyFilter();

        response.results.forEach(tk => {
          const duration = tk.currentDuration || 300;
          this.timer.initializeTimer(tk.id, duration);
          this.timer.remoteTimeKeeper[tk.id.toString()] = tk;

          if (tk.currentDuration !== undefined && tk.currentDuration !== null) {
            this.timer.timeKeeper[tk.id.toString()].current = tk.currentDuration;
            this.timer.timeKeeper[tk.id.toString()].previousStop = tk.currentDuration;
            this.timer.timeKeeper[tk.id.toString()].duration = tk.currentDuration;
          }

          if (tk.started) {
            const utcDate = new Date(tk.startTime).getTime();
            this.timer.timeKeeper[tk.id.toString()].startTime = utcDate;
            this.timer.timeKeeper[tk.id.toString()].started = true;
          }
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load timekeepers');
        console.error('Error loading timekeepers:', err);
        this.loading.set(false);
      }
    });
  }

  applyFilter(): void {
    const filter = this.filterType();
    const all = this.timekeepers();

    if (filter === 'standalone') {
      this.filteredTimekeepers.set(all.filter(tk => !tk.session && !tk.step));
    } else if (filter === 'session') {
      this.filteredTimekeepers.set(all.filter(tk => tk.session || tk.step));
    } else {
      this.filteredTimekeepers.set(all);
    }
  }

  setFilter(type: 'all' | 'standalone' | 'session'): void {
    this.filterType.set(type);
    this.applyFilter();
  }

  createTimer(): void {
    if (!this.newTimerName.trim()) {
      this.toastService.error('Please enter a timer name');
      return;
    }

    this.timeKeeperService.createTimeKeeper({
      name: this.newTimerName.trim(),
      started: false,
      currentDuration: this.newTimerDuration,
      originalDuration: this.newTimerDuration
    }).subscribe({
      next: (tk) => {
        this.newTimerName = '';
        this.newTimerDuration = 300;
        this.showCreateForm.set(false);
        this.currentPage.set(1);
        this.loadTimekeepers();
        this.toastService.success('Timer created successfully');
      },
      error: (err) => {
        this.toastService.error('Failed to create timer');
        console.error('Error creating timer:', err);
      }
    });
  }

  startTimer(id: number): void {
    const tk = this.timer.remoteTimeKeeper[id.toString()];
    if (!tk) return;

    this.timeKeeperService.startTimer(tk.id).subscribe({
      next: (response) => {
        this.timer.remoteTimeKeeper[id.toString()] = response.timeKeeper;
        const utcDate = new Date(response.timeKeeper.startTime).getTime();
        this.timer.timeKeeper[id.toString()].previousStop = this.timer.timeKeeper[id.toString()].current;
        this.timer.timeKeeper[id.toString()].startTime = utcDate;
        this.timer.timeKeeper[id.toString()].started = true;

        this.timekeepers.update(tks =>
          tks.map(t => t.id === id ? response.timeKeeper : t)
        );
      },
      error: (err) => {
        this.toastService.error('Failed to start timer');
        console.error('Error starting timer:', err);
      }
    });
  }

  pauseTimer(id: number): void {
    const tk = this.timer.remoteTimeKeeper[id.toString()];
    if (!tk) return;

    const timerState = this.timer.timeKeeper[id.toString()];
    const now = Date.now();
    const elapsedSeconds = (now - timerState.startTime) / 1000;
    const currentRemaining = Math.max(0, Math.floor(timerState.previousStop - elapsedSeconds));

    this.timer.timeKeeper[id.toString()].started = false;
    this.timer.timeKeeper[id.toString()].current = currentRemaining;
    this.timer.timeKeeper[id.toString()].previousStop = currentRemaining;

    this.timeKeeperService.patchTimeKeeper(tk.id, { currentDuration: currentRemaining }).subscribe({
      next: () => {
        this.timeKeeperService.stopTimer(tk.id).subscribe({
          next: (response) => {
            this.timer.remoteTimeKeeper[id.toString()] = response.timeKeeper;
            if (response.timeKeeper.currentDuration !== undefined && response.timeKeeper.currentDuration !== null) {
              this.timer.timeKeeper[id.toString()].current = response.timeKeeper.currentDuration;
              this.timer.timeKeeper[id.toString()].previousStop = response.timeKeeper.currentDuration;
            }
            this.timekeepers.update(tks =>
              tks.map(t => t.id === id ? response.timeKeeper : t)
            );
            this.applyFilter();
          },
          error: (err) => {
            this.toastService.error('Failed to stop timer');
            console.error('Error stopping timer:', err);
          }
        });
      },
      error: (err) => {
        this.toastService.error('Failed to pause timer');
        console.error('Error pausing timer:', err);
      }
    });
  }

  resetTimer(id: number): void {
    const tk = this.timer.remoteTimeKeeper[id.toString()];
    if (!tk || !this.timer.timeKeeper[id.toString()]) return;

    const originalDuration = tk.originalDuration || tk.currentDuration || 300;
    this.timer.timeKeeper[id.toString()].current = originalDuration;
    this.timer.timeKeeper[id.toString()].previousStop = originalDuration;
    this.timer.timeKeeper[id.toString()].started = false;
    this.timer.timeKeeper[id.toString()].duration = originalDuration;

    this.timeKeeperService.resetTimer(tk.id).subscribe({
      next: (response) => {
        this.timer.remoteTimeKeeper[id.toString()] = response.timeKeeper;
        this.timekeepers.update(tks =>
          tks.map(t => t.id === id ? response.timeKeeper : t)
        );
      },
      error: (err) => {
        this.toastService.error('Failed to reset timer');
        console.error('Error resetting timer:', err);
      }
    });
  }

  deleteTimer(id: number): void {
    if (!confirm('Are you sure you want to delete this timer?')) {
      return;
    }

    this.timeKeeperService.deleteTimeKeeper(id).subscribe({
      next: () => {
        if (this.selectedTimer()?.id === id) {
          this.selectedTimer.set(null);
          this.selectedTimerSession.set(null);
          this.selectedTimerStep.set(null);
        }

        delete this.timer.timeKeeper[id.toString()];
        delete this.timer.remoteTimeKeeper[id.toString()];

        if (this.timekeepers().length === 1 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
        }

        this.loadTimekeepers();
        this.toastService.success('Timer deleted successfully');
      },
      error: (err) => {
        this.toastService.error('Failed to delete timer');
        console.error('Error deleting timer:', err);
      }
    });
  }

  cancelCreate(): void {
    this.newTimerName = '';
    this.newTimerDuration = 300;
    this.showCreateForm.set(false);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadTimekeepers();
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadTimekeepers();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadTimekeepers();
    }
  }

  formatDuration(seconds: number | undefined): string {
    if (seconds === undefined || seconds === null) {
      return 'N/A';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  selectTimer(tk: TimeKeeper): void {
    this.selectedTimer.set(tk);
    this.loadTimerDetails(tk);
  }

  loadTimerDetails(tk: TimeKeeper): void {
    this.loadingDetails.set(true);
    this.selectedTimerSession.set(null);
    this.selectedTimerStep.set(null);

    this.timeKeeperService.getTimeKeeper(tk.id).subscribe({
      next: (fullTimer) => {
        this.selectedTimer.set(fullTimer);
        this.timekeepers.update(tks =>
          tks.map(t => t.id === fullTimer.id ? fullTimer : t)
        );
        this.timer.remoteTimeKeeper[fullTimer.id.toString()] = fullTimer;

        if (fullTimer.session) {
          this.sessionService.getSession(fullTimer.session).subscribe({
            next: (session) => {
              this.selectedTimerSession.set(session);
              if (!fullTimer.step) {
                this.loadingDetails.set(false);
              }
            },
            error: (err) => {
              console.error('Error loading session:', err);
              if (!fullTimer.step) {
                this.loadingDetails.set(false);
              }
            }
          });
        }

        if (fullTimer.step) {
          this.protocolStepService.getProtocolStep(fullTimer.step).subscribe({
            next: (step) => {
              this.selectedTimerStep.set(step);
              this.loadingDetails.set(false);
            },
            error: (err) => {
              console.error('Error loading step:', err);
              this.loadingDetails.set(false);
            }
          });
        }

        if (!fullTimer.session && !fullTimer.step) {
          this.loadingDetails.set(false);
        }
      },
      error: (err) => {
        console.error('Error loading timer details:', err);
        this.loadingDetails.set(false);
      }
    });
  }

  private initializeWebSocket(): void {
    const token = this.authService.getAccessToken();
    if (token) {
      this.timeKeeperWsService.connect(environment.websocketUrl, token);

      this.wsSubscriptions.push(
        this.timeKeeperWsService.timeKeeperStarted$.subscribe({
          next: (event) => {
            console.log('TimeKeeper started:', event);
            const timekeeperId = parseInt(event.timekeeperId);
            const tk = this.timekeepers().find(t => t.id === timekeeperId);
            if (tk && this.timer.timeKeeper[timekeeperId.toString()]) {
              this.timer.timeKeeper[timekeeperId.toString()].previousStop = this.timer.timeKeeper[timekeeperId.toString()].current;
              this.timer.timeKeeper[timekeeperId.toString()].startTime = new Date(event.startTime).getTime();
              this.timer.timeKeeper[timekeeperId.toString()].started = true;
              this.timekeepers.update(tks =>
                tks.map(t => t.id === timekeeperId ? { ...t, started: true, startTime: event.startTime } : t)
              );
              this.applyFilter();
            }
          },
          error: (err) => console.error('WebSocket timeKeeperStarted error:', err)
        })
      );

      this.wsSubscriptions.push(
        this.timeKeeperWsService.timeKeeperStopped$.subscribe({
          next: (event) => {
            console.log('TimeKeeper stopped:', event);
            const timekeeperId = parseInt(event.timekeeperId);
            const tk = this.timekeepers().find(t => t.id === timekeeperId);
            if (tk && this.timer.timeKeeper[timekeeperId.toString()]) {
              this.timer.timeKeeper[timekeeperId.toString()].started = false;
              this.timer.timeKeeper[timekeeperId.toString()].previousStop = this.timer.timeKeeper[timekeeperId.toString()].current;
              if (event.duration !== undefined) {
                this.timer.timeKeeper[timekeeperId.toString()].current = event.duration;
                this.timer.timeKeeper[timekeeperId.toString()].previousStop = event.duration;
              }
              this.timekeepers.update(tks =>
                tks.map(t => t.id === timekeeperId ? {
                  ...t,
                  started: false,
                  currentDuration: event.duration !== undefined ? event.duration : t.currentDuration
                } : t)
              );
              this.applyFilter();
            }
          },
          error: (err) => console.error('WebSocket timeKeeperStopped error:', err)
        })
      );

      this.wsSubscriptions.push(
        this.timeKeeperWsService.timeKeeperUpdated$.subscribe({
          next: (event) => {
            console.log('TimeKeeper updated:', event);
            const timekeeperId = parseInt(event.timekeeperId);
            if (this.timer.timeKeeper[timekeeperId.toString()]) {
              if (event.duration !== undefined) {
                this.timer.timeKeeper[timekeeperId.toString()].current = event.duration;
                this.timer.timeKeeper[timekeeperId.toString()].previousStop = event.duration;
                this.timer.timeKeeper[timekeeperId.toString()].duration = event.duration;
              }
            }
            this.timekeepers.update(tks =>
              tks.map(t => {
                if (t.id === timekeeperId) {
                  return {
                    ...t,
                    name: event.name || t.name,
                    started: event.started !== undefined ? event.started : t.started,
                    currentDuration: event.duration !== undefined ? event.duration : t.currentDuration
                  };
                }
                return t;
              })
            );
            this.applyFilter();
          },
          error: (err) => console.error('WebSocket timeKeeperUpdated error:', err)
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.wsSubscriptions.forEach(sub => sub.unsubscribe());
    this.timeKeeperWsService.disconnect();
    this.timer.ngOnDestroy();
  }
}
