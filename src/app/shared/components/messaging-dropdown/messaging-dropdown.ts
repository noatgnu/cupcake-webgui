import { Component, inject, OnInit, signal, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MessageThreadService } from '@noatgnu/cupcake-mint-chocolate';
import type { MessageThread } from '@noatgnu/cupcake-mint-chocolate';
import { DropdownCoordinator } from '../../services/dropdown-coordinator';

@Component({
  selector: 'app-messaging-dropdown',
  imports: [CommonModule],
  templateUrl: './messaging-dropdown.html',
  styleUrl: './messaging-dropdown.scss'
})
export class MessagingDropdown implements OnInit {
  private messageThreadService = inject(MessageThreadService);
  private router = inject(Router);
  private dropdownCoordinator = inject(DropdownCoordinator);

  @ViewChild('toggleButton', { read: ElementRef }) toggleButton?: ElementRef;

  threads = signal<MessageThread[]>([]);
  unreadCount = signal(0);
  loading = signal(false);
  isOpen = signal(false);
  dropdownPosition = signal({ bottom: 0, left: 0 });

  constructor() {
    effect(() => {
      const activeDropdown = this.dropdownCoordinator.getActiveDropdown();
      if (activeDropdown !== 'messaging') {
        this.isOpen.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.loadRecentThreads();
  }

  loadRecentThreads(): void {
    this.loading.set(true);
    this.messageThreadService.getActiveThreads().subscribe({
      next: (response) => {
        this.threads.set(response.results.slice(0, 5));
        const totalUnread = response.results.reduce((sum, thread) => sum + (thread.messagesCount || 0), 0);
        this.unreadCount.set(totalUnread);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading message threads:', err);
        this.loading.set(false);
      }
    });
  }

  toggleDropdown(): void {
    const willBeOpen = !this.isOpen();
    if (willBeOpen) {
      this.dropdownCoordinator.openDropdown('messaging');
      this.isOpen.set(true);
      this.calculateDropdownPosition();
      this.loadRecentThreads();
    } else {
      this.dropdownCoordinator.closeDropdown('messaging');
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
      return `${baseClasses} btn-success`;
    }
    if (this.unreadCount() > 0) {
      return `${baseClasses} btn-outline-success`;
    }
    return `${baseClasses} btn-link text-decoration-none`;
  }

  viewThread(thread: MessageThread): void {
    this.dropdownCoordinator.closeDropdown('messaging');
    this.router.navigate(['/home/messages', thread.id]);
    this.isOpen.set(false);
  }

  viewAll(): void {
    this.dropdownCoordinator.closeDropdown('messaging');
    this.router.navigate(['/home/messages']);
    this.isOpen.set(false);
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

  getParticipantsText(thread: MessageThread): string {
    if (thread.participantsCount === 1) return '1 participant';
    return `${thread.participantsCount} participants`;
  }
}
