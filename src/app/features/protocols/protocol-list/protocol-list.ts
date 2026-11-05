import { Component, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProtocolService } from '@noatgnu/cupcake-red-velvet';
import type { ProtocolModel } from '@noatgnu/cupcake-red-velvet';
import { AuthService, ToastService } from '@noatgnu/cupcake-core';
import { AccessUtils } from '../../../shared/utils/access.utils';
import { ProtocolCreateModal } from '../protocol-create-modal/protocol-create-modal';
import { SessionCreateModal } from '../session-create-modal/session-create-modal';
import { ProtocolRating } from '../protocol-rating/protocol-rating';

@Component({
  selector: 'app-protocol-list',
  imports: [CommonModule, FormsModule, ProtocolRating],
  templateUrl: './protocol-list.html',
  styleUrl: './protocol-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProtocolList implements OnInit {
  private protocolService = inject(ProtocolService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private modalService = inject(NgbModal);
  private authService = inject(AuthService);

  protocols = signal<ProtocolModel[]>([]);
  selectedProtocol = signal<ProtocolModel | null>(null);
  canEditSelected = computed(() => AccessUtils.canChange(this.selectedProtocol(), this.authService.currentUser()));
  readonly denied = AccessUtils.OWNER_OR_EDITOR_ONLY;
  loading = signal(false);
  searchTerm = '';
  accessTypeFilter = signal<'all' | 'owned' | 'shared' | 'public'>('all');

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

    const accessType = this.accessTypeFilter();
    let observable;

    if (accessType !== 'all') {
      observable = this.protocolService.getProtocolsByAccessType(accessType, params);
    } else {
      observable = this.protocolService.getProtocols(params);
    }

    observable.subscribe({
      next: (response) => {
        this.protocols.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load protocols');
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.loadProtocols();
  }

  onAccessTypeChange(accessType: 'all' | 'owned' | 'shared' | 'public'): void {
    this.accessTypeFilter.set(accessType);
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

  selectProtocol(protocol: ProtocolModel): void {
    this.selectedProtocol.set(protocol);
  }

  /**
   * Reload the selected protocol to pick up its new rating averages.
   */
  refreshSelectedProtocol(): void {
    const protocol = this.selectedProtocol();
    if (!protocol) {
      return;
    }
    this.protocolService.getProtocol(protocol.id).subscribe({
      next: (updated) => {
        this.selectedProtocol.set(updated);
        this.protocols.update(list => list.map(p => (p.id === updated.id ? updated : p)));
      },
      error: () => this.toastService.error('Failed to refresh protocol')
    });
  }

  deselectProtocol(): void {
    this.selectedProtocol.set(null);
  }

  openProtocolEditor(protocolId: number): void {
    this.router.navigate(['/protocols', protocolId, 'edit']);
  }

  editSelectedProtocol(): void {
    const protocol = this.selectedProtocol();
    if (protocol) {
      this.openProtocolEditor(protocol.id);
    }
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
      }
    });
  }

  toggleEnabled(protocol: ProtocolModel, event: Event): void {
    event.stopPropagation();

    this.protocolService.toggleEnabled(protocol.id).subscribe({
      next: (response) => {
        protocol.enabled = response.enabled;
        this.toastService.success(response.message);
      },
      error: () => {
        this.toastService.error('Failed to update protocol');
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
