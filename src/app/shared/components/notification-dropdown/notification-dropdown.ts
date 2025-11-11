import { Component, inject, OnInit, OnDestroy, signal, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService, CommunicationWebSocketService } from '@noatgnu/cupcake-mint-chocolate';
import type { Notification, NotificationPriority } from '@noatgnu/cupcake-mint-chocolate';
import { DropdownCoordinator } from '../../services/dropdown-coordinator';

@Component({
  selector: 'app-notification-dropdown',
  imports: [CommonModule],
  templateUrl: './notification-dropdown.html',
  styleUrl: './notification-dropdown.scss'
})
export class NotificationDropdown implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private wsService = inject(CommunicationWebSocketService);
  private dropdownCoordinator = inject(DropdownCoordinator);

  @ViewChild('toggleButton', { read: ElementRef }) toggleButton?: ElementRef;

  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);
  loading = signal(false);
  isOpen = signal(false);
  dropdownPosition = signal({ bottom: 0, left: 0 });

  private wsSubscription?: Subscription;

  constructor() {
    effect(() => {
      const activeDropdown = this.dropdownCoordinator.getActiveDropdown();
      if (activeDropdown !== 'notification') {
        this.isOpen.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.loadUnreadNotifications();
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
        this.loadUnreadNotifications();
      },
      error: (err) => {
        console.error('WebSocket notification error:', err);
      }
    });
  }

  loadUnreadNotifications(): void {
    this.loading.set(true);
    this.notificationService.getUnreadNotifications().subscribe({
      next: (response) => {
        this.notifications.set(response.results.slice(0, 5));
        this.unreadCount.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading notifications:', err);
        this.loading.set(false);
      }
    });
  }

  toggleDropdown(): void {
    const willBeOpen = !this.isOpen();
    if (willBeOpen) {
      this.dropdownCoordinator.openDropdown('notification');
      this.isOpen.set(true);
      this.calculateDropdownPosition();
      this.loadUnreadNotifications();
    } else {
      this.dropdownCoordinator.closeDropdown('notification');
      this.isOpen.set(false);
    }
  }

  calculateDropdownPosition(): void {
    if (!this.toggleButton) return;

    const button = this.toggleButton.nativeElement;
    const rect = button.getBoundingClientRect();

    const bottom = window.innerHeight - rect.top;
    const left = rect.right + 5;

    this.dropdownPosition.set({
      bottom: bottom,
      left: left
    });
  }

  getButtonClass(): string {
    const baseClasses = 'btn position-relative p-2';
    if (this.isOpen()) {
      return `${baseClasses} btn-primary`;
    }
    if (this.unreadCount() > 0) {
      return `${baseClasses} btn-outline-primary`;
    }
    return `${baseClasses} btn-link text-decoration-none`;
  }

  markAsRead(notification: Notification): void {
    if (!notification.isRead) {
      this.notificationService.markNotificationRead(notification.id, { isRead: true }).subscribe({
        next: () => {
          this.loadUnreadNotifications();
        },
        error: (err) => {
          console.error('Error marking notification as read:', err);
        }
      });
    }
  }

  viewAll(): void {
    this.dropdownCoordinator.closeDropdown('notification');
    this.router.navigate(['/home/notifications']);
    this.isOpen.set(false);
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
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  hasReagentLink(notification: Notification): boolean {
    return !!(notification.data && notification.data.link);
  }

  navigateToReagent(notification: Notification, event: Event): void {
    event.stopPropagation();
    if (this.hasReagentLink(notification)) {
      this.dropdownCoordinator.closeDropdown('notification');
      this.router.navigateByUrl(notification.data.link);
      this.isOpen.set(false);
      this.markAsRead(notification);
    }
  }
}
