import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastService } from '@noatgnu/cupcake-core';
import { ProtocolsIOProtocolEntry, ProtocolsIOProtocolService } from '@noatgnu/cupcake-protocols-io';

import { ProtocolsIoBrowser } from '../protocols-io-browser/protocols-io-browser';

@Component({
  selector: 'app-protocols-io-import',
  imports: [ProtocolsIoBrowser],
  templateUrl: './protocols-io-import.html',
  styleUrl: './protocols-io-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolsIoImport {
  private protocolsIOProtocolService = inject(ProtocolsIOProtocolService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  importingUri = signal<string | null>(null);

  importProtocol(entry: ProtocolsIOProtocolEntry): void {
    this.importingUri.set(entry.uri);
    this.protocolsIOProtocolService.importFromAccount(entry.uri).subscribe({
      next: protocol => {
        this.importingUri.set(null);
        this.toastService.success(`Imported ${entry.title}`);
        this.router.navigate(['/protocols', protocol.id, 'edit']);
      },
      error: (error: HttpErrorResponse) => {
        this.importingUri.set(null);
        this.toastService.error(error.error?.error || 'Failed to import the protocol from protocols.io');
      }
    });
  }
}
