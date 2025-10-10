import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageThreadService, MessageService } from '@noatgnu/cupcake-mint-chocolate';
import type { MessageThread, Message } from '@noatgnu/cupcake-mint-chocolate';

@Component({
  selector: 'app-messages-view',
  imports: [CommonModule, FormsModule],
  templateUrl: './messages-view.html',
  styleUrl: './messages-view.scss'
})
export class MessagesView implements OnInit {
  private messageThreadService = inject(MessageThreadService);
  private messageService = inject(MessageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(NgbModal);

  threads = signal<MessageThread[]>([]);
  selectedThread = signal<MessageThread | null>(null);
  messages = signal<Message[]>([]);

  loadingThreads = signal(false);
  loadingMessages = signal(false);
  sendingMessage = signal(false);

  threadsTotal = signal(0);
  threadsPage = signal(1);
  readonly threadsPageSize = 10;

  messagesTotal = signal(0);
  messagesPage = signal(1);
  readonly messagesPageSize = 50;

  newMessageContent = '';
  searchQuery = '';

  readonly Math = Math;

  private routeParams = toSignal(this.route.params);

  constructor() {
    effect(() => {
      const params = this.routeParams();
      const threadId = params?.['id'];
      if (threadId && this.selectedThread()?.id !== threadId) {
        this.loadThreadById(threadId);
      }
    });
  }

  ngOnInit(): void {
    this.loadThreads();
    const threadId = this.route.snapshot.params['id'];
    if (threadId) {
      this.loadThreadById(threadId);
    }
  }

  loadThreads(): void {
    this.loadingThreads.set(true);
    const offset = (this.threadsPage() - 1) * this.threadsPageSize;
    const params: any = {
      limit: this.threadsPageSize,
      offset: offset,
      ordering: '-last_message_at'
    };

    if (this.searchQuery) {
      params.search = this.searchQuery;
    }

    this.messageThreadService.getMessageThreads(params).subscribe({
      next: (response) => {
        this.threads.set(response.results);
        this.threadsTotal.set(response.count);
        this.loadingThreads.set(false);
      },
      error: (err) => {
        console.error('Error loading threads:', err);
        this.loadingThreads.set(false);
      }
    });
  }

  loadThreadById(threadId: string): void {
    this.messageThreadService.getMessageThread(threadId).subscribe({
      next: (thread) => {
        this.selectedThread.set(thread);
        this.messagesPage.set(1);
        this.loadMessages(threadId);
      },
      error: (err) => {
        console.error('Error loading thread:', err);
      }
    });
  }

  selectThread(thread: MessageThread): void {
    this.router.navigate(['/home/messages', thread.id]);
  }

  loadMessages(threadId: string): void {
    this.loadingMessages.set(true);
    const offset = (this.messagesPage() - 1) * this.messagesPageSize;
    const params: any = {
      thread: threadId,
      limit: this.messagesPageSize,
      offset: offset,
      ordering: 'created_at'
    };

    this.messageService.getMessages(params).subscribe({
      next: (response) => {
        this.messages.set(response.results);
        this.messagesTotal.set(response.count);
        this.loadingMessages.set(false);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Error loading messages:', err);
        this.loadingMessages.set(false);
      }
    });
  }

  sendMessage(): void {
    const thread = this.selectedThread();
    if (!thread || !this.newMessageContent.trim()) {
      return;
    }

    this.sendingMessage.set(true);
    this.messageService.createMessage({
      thread: thread.id,
      content: this.newMessageContent.trim()
    }).subscribe({
      next: () => {
        this.newMessageContent = '';
        this.loadMessages(thread.id);
        this.loadThreads();
        this.sendingMessage.set(false);
      },
      error: (err) => {
        console.error('Error sending message:', err);
        this.sendingMessage.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.threadsPage.set(1);
    this.loadThreads();
  }

  previousThreadsPage(): void {
    if (this.threadsPage() > 1) {
      this.threadsPage.update(p => p - 1);
      this.loadThreads();
    }
  }

  nextThreadsPage(): void {
    if (this.threadsPage() * this.threadsPageSize < this.threadsTotal()) {
      this.threadsPage.update(p => p + 1);
      this.loadThreads();
    }
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

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  scrollToBottom(): void {
    const messagesContainer = document.querySelector('.messages-list');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}
