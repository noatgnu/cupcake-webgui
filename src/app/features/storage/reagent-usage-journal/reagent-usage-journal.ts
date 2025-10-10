import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReagentActionService, ActionType } from '@noatgnu/cupcake-macaron';
import type { ReagentAction } from '@noatgnu/cupcake-macaron';
import { TimeUtils } from '../../../shared/utils/time.utils';

@Component({
  selector: 'app-reagent-usage-journal',
  imports: [CommonModule],
  templateUrl: './reagent-usage-journal.html',
  styleUrl: './reagent-usage-journal.scss'
})
export class ReagentUsageJournal implements OnInit {
  private reagentActionService = inject(ReagentActionService);

  @Input() reagentId!: number;
  @Input() reagentUnit?: string;

  actions = signal<ReagentAction[]>([]);
  loading = signal(false);
  total = signal(0);
  page = signal(1);
  readonly pageSize = 20;
  readonly Math = Math;
  readonly ActionType = ActionType;

  ngOnInit(): void {
    this.loadActions();
  }

  loadActions(): void {
    this.loading.set(true);
    const offset = (this.page() - 1) * this.pageSize;

    this.reagentActionService.getReagentActions({
      reagent: this.reagentId,
      limit: this.pageSize,
      offset: offset,
      ordering: '-created_at'
    }).subscribe({
      next: (response) => {
        this.actions.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading reagent actions:', err);
        this.loading.set(false);
      }
    });
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadActions();
    }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) {
      this.page.update(p => p + 1);
      this.loadActions();
    }
  }

  getActionIcon(actionType: ActionType): string {
    const icons: Record<ActionType, string> = {
      [ActionType.ADD]: 'bi-plus-circle',
      [ActionType.RESERVE]: 'bi-dash-circle'
    };
    return icons[actionType] || 'bi-circle';
  }

  getActionClass(actionType: ActionType): string {
    const classes: Record<ActionType, string> = {
      [ActionType.ADD]: 'text-primary',
      [ActionType.RESERVE]: 'text-danger'
    };
    return classes[actionType] || 'text-secondary';
  }

  getActionBadgeClass(actionType: ActionType): string {
    const classes: Record<ActionType, string> = {
      [ActionType.ADD]: 'bg-success',
      [ActionType.RESERVE]: 'bg-warning text-dark'
    };
    return classes[actionType] || 'bg-secondary';
  }

  getTimeAgo(dateString: string): string {
    return TimeUtils.getTimeAgo(dateString);
  }

  formatDate(dateString: string): string {
    return TimeUtils.formatDate(dateString);
  }
}
