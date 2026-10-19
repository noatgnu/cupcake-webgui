import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ToastService } from '@noatgnu/cupcake-core';
import { ProtocolsIOAccountService, ProtocolsIOAccountStatus } from '@noatgnu/cupcake-red-velvet';

@Component({
  selector: 'app-protocols-io-account',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './protocols-io-account.html',
  styleUrl: './protocols-io-account.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolsIoAccount implements OnInit {
  private accountService = inject(ProtocolsIOAccountService);
  private toastService = inject(ToastService);

  readonly developerPageUrl = 'https://www.protocols.io/developers';

  status = signal<ProtocolsIOAccountStatus | null>(null);
  loading = signal(true);
  saving = signal(false);
  confirmingDisconnect = signal(false);
  token = signal('');

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading.set(true);
    this.accountService.getStatus().subscribe({
      next: status => {
        this.status.set(status);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load the protocols.io account');
        this.loading.set(false);
      }
    });
  }

  connect(): void {
    const token = this.token().trim();
    if (!token) {
      this.toastService.warning('Paste a protocols.io access token first');
      return;
    }
    this.saving.set(true);
    this.accountService.connect(token).subscribe({
      next: status => {
        this.status.set(status);
        this.token.set('');
        this.saving.set(false);
        this.toastService.success(`Connected to protocols.io as ${status.username}`);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.toastService.error(error.error?.error || 'Failed to connect the protocols.io account');
      }
    });
  }

  disconnect(): void {
    this.saving.set(true);
    this.accountService.disconnect().subscribe({
      next: () => {
        this.status.set({ connected: false });
        this.confirmingDisconnect.set(false);
        this.saving.set(false);
        this.toastService.success('protocols.io account disconnected');
      },
      error: () => {
        this.saving.set(false);
        this.toastService.error('Failed to disconnect the protocols.io account');
      }
    });
  }
}
