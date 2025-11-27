import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { StorageService, ReagentService, StoredReagent, ActionType } from '@noatgnu/cupcake-macaron';
import { StorageObject, StorageObjectType, StorageObjectTypeLabels, StoragePathItem } from '@noatgnu/cupcake-macaron';
import { type MetadataColumn } from '@noatgnu/cupcake-vanilla';
import { StorageCreateModal } from '../storage-create-modal/storage-create-modal';
import { StorageEditModal } from '../storage-edit-modal/storage-edit-modal';
import { StorageAccessModal } from '../storage-access-modal/storage-access-modal';
import { StoredReagentCreateModal } from '../stored-reagent-create-modal/stored-reagent-create-modal';
import { StoredReagentEditModal } from '../stored-reagent-edit-modal/stored-reagent-edit-modal';
import { StoredReagentAnnotationsModal } from '../stored-reagent-annotations-modal/stored-reagent-annotations-modal';
import { StoredReagentAccessModal } from '../stored-reagent-access-modal/stored-reagent-access-modal';
import { ImageViewerModal } from '../../../shared/components/image-viewer-modal/image-viewer-modal';
import { ReagentUsageJournalModal } from '../reagent-usage-journal-modal/reagent-usage-journal-modal';
import { ReagentActionModal } from '../reagent-action-modal/reagent-action-modal';
import { BarcodeSearchModal } from '../barcode-search-modal/barcode-search-modal';
import { ReagentMetadataModal } from '../reagent-metadata-modal/reagent-metadata-modal';
import { filter, forkJoin } from 'rxjs';

@Component({
  selector: 'app-storage-list',
  imports: [CommonModule, FormsModule, NgbTooltipModule],
  templateUrl: './storage-list.html',
  styleUrl: './storage-list.scss'
})
export class StorageList implements OnInit {
  private storageService = inject(StorageService);
  private reagentService = inject(ReagentService);
  private modal = inject(NgbModal);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @Input() parentStorageId?: number;

  currentStorageId = signal<number | null>(null);
  currentStorage = signal<StorageObject | null>(null);
  selectedStorage = signal<StorageObject | null>(null);
  childStorageObjects = signal<StorageObject[]>([]);
  storedReagents = signal<StoredReagent[]>([]);
  breadcrumbs = signal<StoragePathItem[]>([]);
  sharedReagentId = signal<number | null>(null);
  reagentStoragePaths = signal<Map<number, StoragePathItem[]>>(new Map());
  reagentMetadata = signal<Map<number, MetadataColumn[]>>(new Map());

  loadingChildren = signal(false);
  loadingReagents = signal(false);
  loadingBreadcrumbs = signal(false);
  loadingMetadata = signal(false);
  error = signal<string | null>(null);

  childTotal = signal(0);
  childPage = signal(1);

  reagentTotal = signal(0);
  reagentPage = signal(1);
  reagentSearch = '';
  includeSubStorage = false;
  molecularWeightMin: number | null = null;
  molecularWeightMax: number | null = null;

  readonly pageSize = 10;
  readonly typeLabels = StorageObjectTypeLabels;
  readonly Math = Math;

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.handleRouteChange();
    });

    this.handleRouteChange();
  }

  handleRouteChange(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const reagentIdParam = this.route.snapshot.queryParamMap.get('reagentId');

    if (reagentIdParam) {
      const reagentId = parseInt(reagentIdParam, 10);
      this.sharedReagentId.set(reagentId);
      this.loadReagentAndParentStorage(reagentId);
    } else {
      this.sharedReagentId.set(null);
      if (id) {
        const storageId = parseInt(id, 10);
        if (this.currentStorageId() !== storageId) {
          this.loadStorageById(storageId);
        }
      } else {
        if (this.currentStorageId() !== null) {
          this.currentStorageId.set(null);
          this.currentStorage.set(null);
          this.selectedStorage.set(null);
          this.storedReagents.set([]);
          this.breadcrumbs.set([]);
          this.childPage.set(1);
          this.loadChildStorageObjects();
        } else if (!this.childStorageObjects().length) {
          this.loadChildStorageObjects();
        }
      }
    }
  }

  loadStorageById(id: number): void {
    this.storageService.getStorageObject(id).subscribe({
      next: (storage) => {
        this.currentStorageId.set(storage.id);
        this.currentStorage.set(storage);
        this.selectedStorage.set(storage);
        this.childPage.set(1);
        this.reagentPage.set(1);
        this.reagentSearch = '';
        this.includeSubStorage = false;
        this.molecularWeightMin = null;
        this.molecularWeightMax = null;
        this.loadChildStorageObjects();
        this.loadBreadcrumbs();
        this.loadStoredReagents();
      },
      error: (err) => {
        this.toastService.error('Failed to load storage object');
        console.error('Error loading storage object:', err);
        this.router.navigate(['/storage']);
      }
    });
  }

  loadCurrentStorage(): void {
    const id = this.currentStorageId();
    if (!id) return;

    this.storageService.getStorageObject(id).subscribe({
      next: (storage) => {
        this.currentStorage.set(storage);
      },
      error: (err) => {
        console.error('Error loading current storage:', err);
      }
    });
  }

  loadBreadcrumbs(): void {
    const id = this.currentStorageId();
    if (!id) {
      this.breadcrumbs.set([]);
      return;
    }

    this.loadingBreadcrumbs.set(true);
    this.storageService.getStorageObject(id).subscribe({
      next: (storage) => {
        if (storage.fullPath && storage.fullPath.length > 0) {
          this.breadcrumbs.set(storage.fullPath);
        } else {
          this.breadcrumbs.set([]);
        }
        this.loadingBreadcrumbs.set(false);
      },
      error: (err) => {
        console.error('Error loading breadcrumbs:', err);
        this.loadingBreadcrumbs.set(false);
      }
    });
  }

  loadChildStorageObjects(): void {
    this.loadingChildren.set(true);
    this.error.set(null);

    const offset = (this.childPage() - 1) * this.pageSize;
    const params: any = {
      limit: this.pageSize,
      offset: offset
    };

    const currentId = this.currentStorageId();
    if (currentId) {
      params.stored_at = currentId;
    } else if (this.parentStorageId) {
      params.stored_at = this.parentStorageId;
    } else {
      params.stored_at__isnull = true;
    }

    this.storageService.getStorageObjects(params).subscribe({
      next: (response) => {
        this.childStorageObjects.set(response.results);
        this.childTotal.set(response.count);
        this.loadingChildren.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load storage objects');
        this.loadingChildren.set(false);
        console.error('Error loading storage objects:', err);
      }
    });
  }

  navigateToStorage(storage: StorageObject): void {
    this.router.navigate(['/storage', storage.id]);
  }

  navigateToRoot(): void {
    this.router.navigate(['/storage']);
  }

  navigateToBreadcrumb(item: StoragePathItem): void {
    this.router.navigate(['/storage', item.id]);
  }


  loadStoredReagents(): void {
    const storage = this.selectedStorage();
    if (!storage) return;

    this.loadingReagents.set(true);
    const offset = (this.reagentPage() - 1) * this.pageSize;

    const params: any = {
      limit: this.pageSize,
      offset: offset,
      storageObject: storage.id
    };

    if (this.reagentSearch) {
      params.search = this.reagentSearch;
    }

    if (this.includeSubStorage) {
      params.includeSubStorage = true;
    }

    if (this.molecularWeightMin !== null && this.molecularWeightMin > 0) {
      params.molecularWeightGte = this.molecularWeightMin;
    }

    if (this.molecularWeightMax !== null && this.molecularWeightMax > 0) {
      params.molecularWeightLte = this.molecularWeightMax;
    }

    const sharedReagentId = this.sharedReagentId();
    if (sharedReagentId) {
      params.id = sharedReagentId;
    }

    this.reagentService.getStoredReagents(params).subscribe({
      next: (response) => {
        this.storedReagents.set(response.results);
        this.reagentTotal.set(response.count);

        if (this.includeSubStorage && response.results.length > 0) {
          this.loadStoragePathsForReagents(response.results);
        } else {
          this.reagentStoragePaths.set(new Map());
        }

        response.results.forEach(reagent => {
          if (reagent.metadataTableId) {
            this.loadReagentMetadata(reagent.id);
          }
        });

        this.loadingReagents.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load reagents');
        this.loadingReagents.set(false);
        console.error('Error loading reagents:', err);
      }
    });
  }

  loadStoragePathsForReagents(reagents: StoredReagent[]): void {
    const uniqueStorageIds = new Set(reagents.map(r => r.storageObject).filter(id => id !== null && id !== undefined));
    const pathsMap = new Map<number, StoragePathItem[]>();

    const storageObservables = Array.from(uniqueStorageIds).map(storageId =>
      this.storageService.getStorageObject(storageId)
    );

    if (storageObservables.length === 0) {
      this.reagentStoragePaths.set(pathsMap);
      return;
    }

    forkJoin(storageObservables).subscribe({
      next: (storageObjects) => {
        storageObjects.forEach(storage => {
          if (storage.fullPath && storage.fullPath.length > 0) {
            pathsMap.set(storage.id, storage.fullPath);
          }
        });
        this.reagentStoragePaths.set(pathsMap);
      },
      error: (err) => {
        console.error('Error loading storage paths:', err);
        this.reagentStoragePaths.set(pathsMap);
      }
    });
  }

  loadReagentAndParentStorage(reagentId: number): void {
    this.reagentService.getStoredReagent(reagentId).subscribe({
      next: (reagent) => {
        if (reagent.storageObject) {
          this.loadStorageById(reagent.storageObject);
        } else {
          this.toastService.error('Reagent has no storage location');
        }
      },
      error: (err) => {
        this.toastService.error('Failed to load shared reagent');
        console.error('Error loading reagent:', err);
        this.router.navigate(['/storage']);
      }
    });
  }

  onReagentSearchChange(): void {
    this.reagentPage.set(1);
    this.loadStoredReagents();
  }

  onReagentFilterChange(): void {
    this.reagentPage.set(1);
    this.loadStoredReagents();
  }

  previousChildPage(): void {
    if (this.childPage() > 1) {
      this.childPage.update(p => p - 1);
      this.loadChildStorageObjects();
    }
  }

  nextChildPage(): void {
    if (this.childPage() * this.pageSize < this.childTotal()) {
      this.childPage.update(p => p + 1);
      this.loadChildStorageObjects();
    }
  }

  previousReagentPage(): void {
    if (this.reagentPage() > 1) {
      this.reagentPage.update(p => p - 1);
      this.loadStoredReagents();
    }
  }

  nextReagentPage(): void {
    if (this.reagentPage() * this.pageSize < this.reagentTotal()) {
      this.reagentPage.update(p => p + 1);
      this.loadStoredReagents();
    }
  }

  getTypeIcon(type: StorageObjectType): string {
    const icons: Record<StorageObjectType, string> = {
      [StorageObjectType.SHELF]: 'bi-bookshelf',
      [StorageObjectType.BOX]: 'bi-box-seam',
      [StorageObjectType.FRIDGE]: 'bi-snow',
      [StorageObjectType.FREEZER]: 'bi-snow2',
      [StorageObjectType.ROOM]: 'bi-door-open',
      [StorageObjectType.BUILDING]: 'bi-building',
      [StorageObjectType.FLOOR]: 'bi-layers',
      [StorageObjectType.OTHER]: 'bi-archive'
    };
    return icons[type] || 'bi-archive';
  }

  deleteStorage(id: number): void {
    if (!confirm('Are you sure you want to delete this storage object?')) {
      return;
    }

    this.storageService.deleteStorageObject(id).subscribe({
      next: () => {
        this.toastService.success('Storage object deleted');
        if (this.selectedStorage()?.id === id) {
          this.selectedStorage.set(null);
          this.storedReagents.set([]);
        }
        this.loadChildStorageObjects();
      },
      error: (err) => {
        this.error.set('Failed to delete storage object');
        this.toastService.error('Failed to delete storage object');
        console.error('Error deleting storage object:', err);
      }
    });
  }

  openCreateModal(parent?: StorageObject | null): void {
    const modalRef = this.modal.open(StorageCreateModal, { scrollable: true });
    if (parent) {
      modalRef.componentInstance.storedAt = parent;
    }
    modalRef.closed.subscribe((data: any) => {
      if (data) {
        this.storageService.createStorageObject({
          objectName: data.name,
          objectType: data.type,
          objectDescription: data.description,
          storedAt: data.storedAt
        }).subscribe({
          next: () => {
            this.toastService.success('Storage object created');
            this.loadChildStorageObjects();
          },
          error: (err) => {
            this.toastService.error('Failed to create storage object');
            console.error('Error creating storage object:', err);
          }
        });
      }
    });
  }

  openEditModal(storage: StorageObject): void {
    const modalRef = this.modal.open(StorageEditModal, { scrollable: true, size: 'lg' });
    modalRef.componentInstance.storageObject = storage;
    modalRef.closed.subscribe((data: any) => {
      if (data) {
        const payload: any = {
          objectName: data.objectName,
          objectDescription: data.objectDescription
        };

        if (data.pngBase64) {
          payload.pngBase64 = data.pngBase64;
        }

        this.storageService.updateStorageObject(storage.id, payload).subscribe({
          next: (updatedStorage) => {
            this.toastService.success('Storage object updated');
            if (this.selectedStorage()?.id === storage.id) {
              this.selectedStorage.set(updatedStorage);
            }
            if (this.currentStorage()?.id === storage.id) {
              this.currentStorage.set(updatedStorage);
              this.loadBreadcrumbs();
            }
            this.loadChildStorageObjects();
          },
          error: (err) => {
            this.toastService.error('Failed to update storage object');
            console.error('Error updating storage object:', err);
          }
        });
      }
    });
  }

  openAccessModal(storage: StorageObject): void {
    const modalRef = this.modal.open(StorageAccessModal, { scrollable: true });
    modalRef.componentInstance.storageObject = storage;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadChildStorageObjects();
        if (this.currentStorage()?.id === storage.id) {
          this.loadCurrentStorage();
        }
        if (this.selectedStorage()?.id === storage.id) {
          this.loadCurrentStorage();
        }
      }
    });
  }

  openAddReagentModal(storage: StorageObject): void {
    const modalRef = this.modal.open(StoredReagentCreateModal, { scrollable: true, size: 'lg' });
    modalRef.componentInstance.storageObject = storage;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadStoredReagents();
      }
    });
  }

  openEditReagentModal(storedReagent: StoredReagent): void {
    const modalRef = this.modal.open(StoredReagentEditModal, { scrollable: true, size: 'lg' });
    modalRef.componentInstance.storedReagent = storedReagent;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadStoredReagents();
      }
    });
  }

  openImageModal(event: Event, imageUrl: string, title: string): void {
    event.stopPropagation();
    const modalRef = this.modal.open(ImageViewerModal, { size: 'xl', centered: true });
    modalRef.componentInstance.imageUrl = imageUrl;
    modalRef.componentInstance.title = title;
  }

  openUsageJournalModal(storedReagent: StoredReagent): void {
    const modalRef = this.modal.open(ReagentUsageJournalModal, { scrollable: true, size: 'lg' });
    modalRef.componentInstance.storedReagent = storedReagent;
  }

  openAddQuantityModal(storedReagent: StoredReagent): void {
    const modalRef = this.modal.open(ReagentActionModal, { scrollable: true });
    modalRef.componentInstance.storedReagent = storedReagent;
    modalRef.componentInstance.actionType = ActionType.ADD;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadStoredReagents();
      }
    });
  }

  openReserveQuantityModal(storedReagent: StoredReagent): void {
    const modalRef = this.modal.open(ReagentActionModal, { scrollable: true });
    modalRef.componentInstance.storedReagent = storedReagent;
    modalRef.componentInstance.actionType = ActionType.RESERVE;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadStoredReagents();
      }
    });
  }

  openAnnotationsModal(storedReagent: StoredReagent): void {
    const modalRef = this.modal.open(StoredReagentAnnotationsModal, { scrollable: true, size: 'lg' });
    modalRef.componentInstance.storedReagent = storedReagent;
  }

  openReagentAccessModal(storedReagent: StoredReagent): void {
    const modalRef = this.modal.open(StoredReagentAccessModal, { scrollable: true });
    modalRef.componentInstance.storedReagent = storedReagent;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadStoredReagents();
      }
    });
  }

  copyReagentShareLink(storedReagent: StoredReagent): void {
    const url = `${window.location.origin}/storage/${storedReagent.storageObject}?reagentId=${storedReagent.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toastService.success('Share link copied to clipboard');
    }).catch(err => {
      this.toastService.error('Failed to copy link');
      console.error('Failed to copy:', err);
    });
  }

  isSharedReagentView(): boolean {
    return this.sharedReagentId() !== null;
  }

  clearSharedReagentView(): void {
    this.sharedReagentId.set(null);
    const storage = this.selectedStorage();
    if (storage) {
      this.router.navigate(['/storage', storage.id]);
    }
  }

  openBarcodeScanModal(): void {
    const modalRef = this.modal.open(BarcodeSearchModal, { size: 'lg', centered: true });
    modalRef.closed.subscribe((result: { barcode: string; includeSubStorage: boolean }) => {
      if (result && result.barcode) {
        this.reagentSearch = result.barcode;
        this.includeSubStorage = result.includeSubStorage;
        this.reagentPage.set(1);
        this.loadStoredReagents();
        const searchScope = result.includeSubStorage ? 'in all nested locations' : 'in current location';
        this.toastService.success(`Searching for barcode: ${result.barcode} ${searchScope}`);
      }
    });
  }

  getReagentStoragePath(reagent: StoredReagent): StoragePathItem[] | null {
    if (!reagent.storageObject) return null;
    return this.reagentStoragePaths().get(reagent.storageObject) || null;
  }

  shouldShowStoragePath(reagent: StoredReagent): boolean {
    return this.includeSubStorage && reagent.storageObject !== this.selectedStorage()?.id;
  }

  loadReagentMetadata(reagentId: number): void {
    this.reagentService.getStoredReagentMetadata(reagentId).subscribe({
      next: (metadataTable) => {
        const columns = metadataTable.columns || [];
        const metadataMap = this.reagentMetadata();
        metadataMap.set(reagentId, columns.filter((col: MetadataColumn) => !col.hidden));
        this.reagentMetadata.set(new Map(metadataMap));
      },
      error: (err) => {
        console.error('Error loading reagent metadata:', err);
      }
    });
  }

  getReagentMetadata(reagent: StoredReagent): MetadataColumn[] {
    return this.reagentMetadata().get(reagent.id) || [];
  }

  openReagentMetadataModal(storedReagent: StoredReagent): void {
    if (!storedReagent.metadataTableId) {
      this.toastService.error('No metadata associated with this reagent');
      return;
    }

    const modalRef = this.modal.open(ReagentMetadataModal, { size: 'lg', scrollable: true });
    modalRef.componentInstance.storedReagentId = storedReagent.id;
    modalRef.componentInstance.metadataTableId = storedReagent.metadataTableId;
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadReagentMetadata(storedReagent.id);
        }
      },
      () => {
        // Modal dismissed (e.g., backdrop click or ESC)
      }
    );
  }
}
