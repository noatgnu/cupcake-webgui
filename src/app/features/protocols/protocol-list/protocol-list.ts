import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProtocolService } from '@noatgnu/cupcake-red-velvet';
import type { ProtocolModel } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { ProtocolCreateModal } from '../protocol-create-modal/protocol-create-modal';
import { SessionCreateModal } from '../session-create-modal/session-create-modal';

@Component({
  selector: 'app-protocol-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './protocol-list.html',
  styleUrl: './protocol-list.scss'
})
export class ProtocolList implements OnInit {
  private protocolService = inject(ProtocolService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private modalService = inject(NgbModal);

  protocols = signal<ProtocolModel[]>([]);
  loading = signal(false);
  searchTerm = '';

  total = signal(0);
  page = signal(1);
  readonly pageSize = 10;
  readonly Math = Math;

  ngOnInit(): void {
    this.loadProtocols();
  }

  loadProtocols(): void {
    this.loading.set(true);
    const offset = (this.page() - 1) * this.pageSize;

    const params: any = {
      limit: this.pageSize,
      offset: offset,
      ordering: '-created_at'
    };

    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    this.protocolService.getProtocols(params).subscribe({
      next: (response) => {
        this.protocols.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load protocols');
        console.error('Error loading protocols:', err);
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.loadProtocols();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadProtocols();
    }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) {
      this.page.update(p => p + 1);
      this.loadProtocols();
    }
  }

  openProtocolEditor(protocolId: number): void {
    this.router.navigate(['/protocols', protocolId, 'edit']);
  }

  createNewProtocol(): void {
    const modalRef = this.modalService.open(ProtocolCreateModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.result.then(
      (protocol: ProtocolModel) => {
        this.router.navigate(['/protocols', protocol.id, 'edit']);
      },
      () => {}
    );
  }

  deleteProtocol(id: number, event: Event): void {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this protocol?')) {
      return;
    }

    this.protocolService.deleteProtocol(id).subscribe({
      next: () => {
        this.toastService.success('Protocol deleted successfully');
        this.loadProtocols();
      },
      error: (err) => {
        this.toastService.error('Failed to delete protocol');
        console.error('Error deleting protocol:', err);
      }
    });
  }

  toggleEnabled(protocol: ProtocolModel, event: Event): void {
    event.stopPropagation();

    this.protocolService.updateProtocol(protocol.id, {
      enabled: !protocol.enabled
    }).subscribe({
      next: (updated) => {
        protocol.enabled = updated.enabled;
        this.toastService.success(`Protocol ${protocol.enabled ? 'enabled' : 'disabled'}`);
      },
      error: (err) => {
        this.toastService.error('Failed to update protocol');
        console.error('Error updating protocol:', err);
      }
    });
  }

  startSession(protocol: ProtocolModel, event: Event): void {
    event.stopPropagation();

    const modalRef = this.modalService.open(SessionCreateModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.protocol = protocol;

    modalRef.result.then(
      (session) => {
        this.toastService.success(`Session "${session.name}" created successfully`);
        this.router.navigate(['/protocols/sessions']);
      },
      () => {}
    );
  }
}
