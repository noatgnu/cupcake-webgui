import { Component, inject, OnInit, OnDestroy, signal, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AsyncTaskStatus, TaskStatus, TASK_TYPE_LABELS, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
import { DropdownCoordinator } from '../../services/dropdown-coordinator';

@Component({
  selector: 'app-async-task-dropdown',
  imports: [CommonModule],
  templateUrl: './async-task-dropdown.html',
  styleUrl: './async-task-dropdown.scss'
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

  private taskSubscription?: Subscription;
  private activeTaskSubscription?: Subscription;

  constructor() {
    effect(() => {
      const activeDropdown = this.dropdownCoordinator.getActiveDropdown();
      if (activeDropdown !== 'async-task') {
        this.isOpen.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.loadTasks();
  }

  ngOnDestroy(): void {
    if (this.taskSubscription) {
      this.taskSubscription.unsubscribe();
    }
    if (this.activeTaskSubscription) {
      this.activeTaskSubscription.unsubscribe();
    }
  }

  loadTasks(): void {
    this.taskSubscription = this.asyncTaskService.tasks$.subscribe({
      next: (tasks) => {
        const taskArray = Array.isArray(tasks) ? tasks : [];
        this.recentTasks.set(taskArray.slice(0, 10));
      },
      error: (err) => {
        console.error('AsyncTaskDropdown: Error loading tasks:', err);
      }
    });

    this.activeTaskSubscription = this.asyncTaskService.activeTasks$.subscribe({
      next: (tasks) => {
        const taskArray = Array.isArray(tasks) ? tasks : [];
        this.activeCount.set(taskArray.length);
      },
      error: (err) => {
        console.error('AsyncTaskDropdown: Error loading active tasks:', err);
      }
    });
  }

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
        console.log('Task cancelled successfully:', taskId);
      },
      error: (error) => {
        console.error('Error cancelling task:', error);
      }
    });
  }

  downloadTask(task: AsyncTaskStatus, event: Event): void {
    event.stopPropagation();
    if (task.result?.download_url) {
      const link = document.createElement('a');
      link.href = task.result.download_url;
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
