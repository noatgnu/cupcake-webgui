import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService, NotificationType, NotificationPriority, CommunicationWebSocketService } from '@noatgnu/cupcake-mint-chocolate';
import type { Notification } from '@noatgnu/cupcake-mint-chocolate';

@Component({
  selector: 'app-notifications-view',
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications-view.html',
  styleUrl: './notifications-view.scss'
})
export class NotificationsView implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private wsService = inject(CommunicationWebSocketService);

  notifications = signal<Notification[]>([]);
  loading = signal(false);
  total = signal(0);
  page = signal(1);
  readonly pageSize = 20;

  filterType: string = '';
  filterPriority: string = '';
  filterIsRead: string = '';

  readonly notificationTypes = Object.values(NotificationType);
  readonly notificationPriorities = Object.values(NotificationPriority);
  readonly Math = Math;

  private wsSubscription?: Subscription;

  ngOnInit(): void {
    this.loadNotifications();
    this.subscribeToWebSocketNotifications();
  }

  ngOnDestroy(): void {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
  }

  subscribeToWebSocketNotifications(): void {
    this.wsSubscription = this.wsService.newNotifications$.subscribe({
      next: (event) => {
        console.log('New notification received via WebSocket:', event);
        this.loadNotifications();
      },
      error: (err) => {
        console.error('WebSocket notification error:', err);
      }
    });
  }

  loadNotifications(): void {
    this.loading.set(true);
    const offset = (this.page() - 1) * this.pageSize;
    const params: any = {
      limit: this.pageSize,
      offset: offset
    };

    if (this.filterType) {
      params.notificationType = this.filterType;
    }
    if (this.filterPriority) {
      params.priority = this.filterPriority;
    }
    if (this.filterIsRead) {
      params.isRead = this.filterIsRead === 'true';
    }

    this.notificationService.getNotifications(params).subscribe({
      next: (response) => {
        this.notifications.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading notifications:', err);
        this.loading.set(false);
      }
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadNotifications();
  }

  clearFilters(): void {
    this.filterType = '';
    this.filterPriority = '';
    this.filterIsRead = '';
    this.page.set(1);
    this.loadNotifications();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadNotifications();
    }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) {
      this.page.update(p => p + 1);
      this.loadNotifications();
    }
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markNotificationRead(notification.id, { isRead: true }).subscribe({
      next: () => {
        this.loadNotifications();
      },
      error: (err) => {
        console.error('Error marking notification as read:', err);
      }
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllNotificationsRead().subscribe({
      next: () => {
        this.loadNotifications();
      },
      error: (err) => {
        console.error('Error marking all as read:', err);
      }
    });
  }

  getPriorityClass(priority: NotificationPriority): string {
    const classes: Record<NotificationPriority, string> = {
      low: 'text-secondary',
      normal: 'text-primary',
      high: 'text-warning',
      urgent: 'text-danger'
    };
    return classes[priority] || 'text-secondary';
  }

  getPriorityBadgeClass(priority: NotificationPriority): string {
    const classes: Record<NotificationPriority, string> = {
      low: 'bg-secondary',
      normal: 'bg-primary',
      high: 'bg-warning',
      urgent: 'bg-danger'
    };
    return classes[priority] || 'bg-secondary';
  }

  getPriorityIcon(priority: NotificationPriority): string {
    const icons: Record<NotificationPriority, string> = {
      low: 'bi-info-circle',
      normal: 'bi-bell',
      high: 'bi-exclamation-triangle',
      urgent: 'bi-exclamation-octagon'
    };
    return icons[priority] || 'bi-bell';
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  hasReagentLink(notification: Notification): boolean {
    return !!(notification.data && notification.data.link);
  }

  navigateToReagent(notification: Notification): void {
    if (this.hasReagentLink(notification)) {
      this.router.navigateByUrl(notification.data.link);
      if (!notification.isRead) {
        this.markAsRead(notification);
      }
    }
  }
}
