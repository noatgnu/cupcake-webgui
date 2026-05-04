import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, signal, ElementRef, ViewChild, effect } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncTaskStatus, TaskStatus, TASK_TYPE_LABELS, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
import { DropdownCoordinator } from '../../services/dropdown-coordinator';

@Component({
  selector: 'app-async-task-dropdown',
  imports: [],
  templateUrl: './async-task-dropdown.html',
  styleUrl: './async-task-dropdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AsyncTaskDropdown implements OnInit, OnDestroy {
  private asyncTaskService = inject(AsyncTaskMonitorService);
  private router = inject(Router);
  private dropdownCoordinator = inject(DropdownCoordinator);

  @ViewChild('toggleButton', { read: ElementRef }) toggleButton?: ElementRef;

  recentTasks = signal<AsyncTaskStatus[]>([]);
  activeCount = signal(0);
  isOpen = signal(false);
  dropdownPosition = signal({ bottom: 0, left: 0 });

  readonly taskTypeLabels = TASK_TYPE_LABELS;
  readonly TaskStatus = TaskStatus;

  constructor() {
    effect(() => {
      const activeDropdown = this.dropdownCoordinator.getActiveDropdown();
      if (activeDropdown !== 'async-task') {
        this.isOpen.set(false);
      }
    });

    effect(() => {
      const tasks = this.asyncTaskService.tasks();
      const taskArray = Array.isArray(tasks) ? tasks : [];
      this.recentTasks.set(taskArray.slice(0, 10));
    });

    effect(() => {
      const tasks = this.asyncTaskService.activeTasks();
      const taskArray = Array.isArray(tasks) ? tasks : [];
      this.activeCount.set(taskArray.length);
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  toggleDropdown(): void {
    const willBeOpen = !this.isOpen();
    if (willBeOpen) {
      this.dropdownCoordinator.openDropdown('async-task');
      this.isOpen.set(true);
      this.calculateDropdownPosition();
    } else {
      this.dropdownCoordinator.closeDropdown('async-task');
      this.isOpen.set(false);
    }
  }

  calculateDropdownPosition(): void {
    if (!this.toggleButton) return;

    const button = this.toggleButton.nativeElement;
    const rect = button.getBoundingClientRect();

    this.dropdownPosition.set({
      bottom: window.innerHeight - rect.top,
      left: rect.left + rect.width + 8
    });
  }

  closeDropdown(): void {
    this.dropdownCoordinator.closeDropdown('async-task');
    this.isOpen.set(false);
  }

  viewAllTasks(): void {
    this.closeDropdown();
    this.router.navigate(['/home'], { fragment: 'tasks' });
  }

  getTaskDisplayName(task: AsyncTaskStatus): string {
    return this.taskTypeLabels[task.taskType] || task.taskType;
  }

  getProgressPercentage(task: AsyncTaskStatus): number {
    return task.progressPercentage || 0;
  }

  cancelTask(taskId: string, event: Event): void {
    event.stopPropagation();
    this.asyncTaskService.cancelTask(taskId).subscribe({
      next: () => {
      },
      error: () => {
      }
    });
  }

  downloadTask(task: AsyncTaskStatus, event: Event): void {
    event.stopPropagation();
    if (task.result?.['download_url']) {
      const link = document.createElement('a');
      link.href = task.result['download_url'] as string;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  getButtonClass(): string {
    const baseClasses = 'btn position-relative p-2';
    if (this.isOpen()) {
      return `${baseClasses} btn-primary`;
    }
    if (this.activeCount() > 0) {
      return `${baseClasses} btn-outline-primary`;
    }
    return `${baseClasses} btn-link text-decoration-none`;
  }
}
