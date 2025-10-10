import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbNavModule, NgbTooltipModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin, of } from 'rxjs';
import { InstrumentsNavbar } from '../instruments-navbar/instruments-navbar';
import { InstrumentService, InstrumentPermissionService, InstrumentUsageService, MaintenanceService, MaintenanceType, Status } from '@noatgnu/cupcake-macaron';
import type { Instrument, InstrumentDetail, SupportInformation, ExternalContact, InstrumentPermission, MaintenanceLog, InstrumentUsage } from '@noatgnu/cupcake-macaron';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { type MetadataColumn } from '@noatgnu/cupcake-vanilla';
import { SupportInformationModal } from '../support-information-modal/support-information-modal';
import { InstrumentEditModal } from '../instrument-edit-modal/instrument-edit-modal';
import { ContactsManagementModal } from '../contacts-management-modal/contacts-management-modal';
import { InstrumentMetadataModal } from '../instrument-metadata-modal/instrument-metadata-modal';
import { InstrumentAnnotationsModal } from '../instrument-annotations-modal/instrument-annotations-modal';
import { InstrumentPermissionModal } from '../instrument-permission-modal/instrument-permission-modal';
import { MaintenanceLogEditModal } from '../maintenance-log-edit-modal/maintenance-log-edit-modal';
import { MaintenanceLogAnnotationsModal } from '../maintenance-log-annotations-modal/maintenance-log-annotations-modal';
import { InstrumentUsageModal } from '../instrument-usage-modal/instrument-usage-modal';

@Component({
  selector: 'app-instruments',
  imports: [InstrumentsNavbar, CommonModule, FormsModule, NgbNavModule, NgbTooltipModule, NgbPaginationModule],
  templateUrl: './instruments.html',
  styleUrl: './instruments.scss'
})
export class Instruments implements OnInit {
  private instrumentService = inject(InstrumentService);
  private instrumentPermissionService = inject(InstrumentPermissionService);
  private instrumentUsageService = inject(InstrumentUsageService);
  private maintenanceService = inject(MaintenanceService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private modal = inject(NgbModal);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  instruments = signal<Instrument[]>([]);
  filteredInstruments = signal<Instrument[]>([]);
  selectedInstrument = signal<InstrumentDetail | null>(null);
  selectedSupportInfo = signal<SupportInformation | null>(null);
  userPermission = signal<InstrumentPermission | null>(null);
  metadataColumns = signal<MetadataColumn[]>([]);
  vendorContacts = signal<ExternalContact[]>([]);
  manufacturerContacts = signal<ExternalContact[]>([]);
  maintenanceLogs = signal<MaintenanceLog[]>([]);
  maintenanceLogsTotal = signal(0);
  maintenanceLogsPage = signal(1);
  maintenanceLogsPageSize = 10;
  maintenanceFilterType = signal<MaintenanceType | ''>('');
  maintenanceFilterStatus = signal<Status | ''>('');
  expandedMaintenanceLogId = signal<number | null>(null);
  maintenanceLogDocumentCounts = signal<Map<number, number>>(new Map());
  bookings = signal<InstrumentUsage[]>([]);
  bookingsTotal = signal(0);
  bookingsPage = signal(1);
  bookingsPageSize = 10;
  loading = signal(false);
  loadingDetails = signal(false);
  loadingMetadata = signal(false);
  loadingMaintenanceLogs = signal(false);
  loadingBookings = signal(false);
  activeTab = signal<'overview' | 'support' | 'maintenance' | 'bookings'>('overview');

  MaintenanceType = MaintenanceType;
  Status = Status;

  lastRoutineMaintenance = computed(() => {
    const logs = this.maintenanceLogs();
    const routineLogs = logs.filter(log =>
      log.maintenanceType === 'routine' &&
      log.status === 'completed'
    );
    if (routineLogs.length === 0) return null;
    return routineLogs.sort((a, b) =>
      new Date(b.maintenanceDate).getTime() - new Date(a.maintenanceDate).getTime()
    )[0];
  });

  nextMaintenanceDue = computed(() => {
    const supportInfo = this.selectedSupportInfo();
    const lastMaintenance = this.lastRoutineMaintenance();

    if (!supportInfo?.maintenanceFrequencyDays || !lastMaintenance) {
      return null;
    }

    const lastMaintenanceDate = new Date(lastMaintenance.maintenanceDate);
    const nextDueDate = new Date(lastMaintenanceDate);
    nextDueDate.setDate(nextDueDate.getDate() + supportInfo.maintenanceFrequencyDays);

    return nextDueDate;
  });

  searchTerm = '';
  filterEnabled = signal<'all' | 'enabled' | 'disabled'>('all');
  filterBookings = signal<'all' | 'accepts' | 'no-bookings'>('all');

  currentPage = signal(1);
  pageSize = 10;
  totalCount = signal(0);
  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize));
  Math = Math;

  enabledCount = computed(() =>
    this.instruments().filter(i => i.enabled).length
  );
  disabledCount = computed(() =>
    this.instruments().filter(i => !i.enabled).length
  );

  currentUser = toSignal(this.authService.currentUser$);
  isStaff = computed(() => this.currentUser()?.isStaff || false);
  isStaffOrAdmin = computed(() => {
    const user = this.currentUser();
    return user?.isStaff || user?.isSuperuser || false;
  });
  canManageInstrument = computed(() => {
    const permission = this.userPermission();
    return permission?.canManage || this.isStaff();
  });
  canBookInstrument = computed(() => {
    const permission = this.userPermission();
    return permission?.canBook || permission?.canManage || this.isStaff();
  });

  ngOnInit(): void {
    this.loadInstruments();

    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        const instrumentId = parseInt(id, 10);
        if (!isNaN(instrumentId)) {
          this.loadInstrumentById(instrumentId);
        }
      }
    });
  }

  loadInstruments(): void {
    this.loading.set(true);
    const offset = (this.currentPage() - 1) * this.pageSize;
    const params: any = {
      limit: this.pageSize,
      offset,
      ordering: 'instrumentName'
    };

    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    if (this.filterEnabled() === 'enabled') {
      params.enabled = true;
    } else if (this.filterEnabled() === 'disabled') {
      params.enabled = false;
    }

    if (this.filterBookings() === 'accepts') {
      params.acceptsBookings = true;
    } else if (this.filterBookings() === 'no-bookings') {
      params.acceptsBookings = false;
    }

    this.instrumentService.getInstruments(params).subscribe({
      next: (response) => {
        this.totalCount.set(response.count);
        this.instruments.set(response.results);
        this.applyFilter();
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load instruments');
        console.error('Error loading instruments:', err);
        this.loading.set(false);
      }
    });
  }

  applyFilter(): void {
    this.filteredInstruments.set(this.instruments());
  }

  onSearchChange(): void {
    this.currentPage.set(1);
    this.loadInstruments();
  }

  setEnabledFilter(type: 'all' | 'enabled' | 'disabled'): void {
    this.filterEnabled.set(type);
    this.currentPage.set(1);
    this.loadInstruments();
  }

  setBookingsFilter(type: 'all' | 'accepts' | 'no-bookings'): void {
    this.filterBookings.set(type);
    this.currentPage.set(1);
    this.loadInstruments();
  }

  selectInstrument(instrument: Instrument): void {
    this.activeTab.set('overview');
    this.loadInstrumentDetails(instrument);
    this.router.navigate(['/instruments', instrument.id]);
  }

  loadInstrumentById(id: number): void {
    this.instrumentService.getInstrument(id).subscribe({
      next: (instrument) => {
        this.selectedInstrument.set(instrument);
        this.activeTab.set('overview');
        this.loadInstrumentDetails(instrument);
      },
      error: (err) => {
        this.toastService.error('Failed to load instrument');
        console.error('Error loading instrument by ID:', err);
        this.router.navigate(['/instruments']);
      }
    });
  }

  deselectInstrument(): void {
    this.selectedInstrument.set(null);
    this.router.navigate(['/instruments']);
  }

  loadInstrumentDetails(instrument: Instrument | InstrumentDetail): void {
    this.loadingDetails.set(true);
    this.selectedSupportInfo.set(null);
    this.userPermission.set(null);
    this.vendorContacts.set([]);
    this.manufacturerContacts.set([]);
    this.metadataColumns.set([]);

    this.instrumentService.getInstrument(instrument.id).subscribe({
      next: (fullInstrument) => {
        this.selectedInstrument.set(fullInstrument);
        const instrumentForList: Instrument = {
          ...fullInstrument,
          supportInformation: fullInstrument.supportInformation?.map(si => si.id)
        };
        this.instruments.update(instruments =>
          instruments.map(i => i.id === fullInstrument.id ? instrumentForList : i)
        );
        this.applyFilter();
        this.loadingDetails.set(false);

        if (fullInstrument.supportInformation && fullInstrument.supportInformation.length > 0 && this.isStaffOrAdmin()) {
          const supportInfo = fullInstrument.supportInformation[0];
          this.selectedSupportInfo.set(supportInfo);

          if (supportInfo.vendorContacts && supportInfo.vendorContacts.length > 0) {
            this.vendorContacts.set(supportInfo.vendorContacts);
          }

          if (supportInfo.manufacturerContacts && supportInfo.manufacturerContacts.length > 0) {
            this.manufacturerContacts.set(supportInfo.manufacturerContacts);
          }
        }

        if (fullInstrument.metadataTableId) {
          this.loadMetadataColumns(fullInstrument.id);
        }

        const currentUser = this.currentUser();
        if (currentUser) {
          this.instrumentPermissionService.getInstrumentPermissions({
            instrument: fullInstrument.id,
            user: currentUser.id
          }).subscribe({
            next: (response) => {
              if (response.results.length > 0) {
                this.userPermission.set(response.results[0]);
              }
            },
            error: (err) => {
              console.error('Error loading user permission:', err);
            }
          });
        }
      },
      error: (err) => {
        console.error('Error loading instrument details:', err);
        this.loadingDetails.set(false);
      }
    });
  }

  loadMetadataColumns(instrumentId: number): void {
    this.loadingMetadata.set(true);
    this.instrumentService.getInstrumentMetadata(instrumentId).subscribe({
      next: (metadataTable) => {
        const columns = metadataTable.columns || [];
        this.metadataColumns.set(columns.filter((col: MetadataColumn) => !col.hidden));
        this.loadingMetadata.set(false);
      },
      error: (err: any) => {
        console.error('Error loading metadata columns:', err);
        this.loadingMetadata.set(false);
      }
    });
  }

  deleteInstrument(id: number): void {
    if (!this.isStaff()) {
      this.toastService.error('Only staff members can delete instruments');
      return;
    }

    if (!confirm('Are you sure you want to delete this instrument?')) {
      return;
    }

    this.instrumentService.deleteInstrument(id).subscribe({
      next: () => {
        if (this.selectedInstrument()?.id === id) {
          this.selectedInstrument.set(null);
          this.router.navigate(['/instruments']);
        }

        if (this.instruments().length === 1 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
        }

        this.loadInstruments();
        this.toastService.success('Instrument deleted successfully');
      },
      error: (err) => {
        this.toastService.error('Failed to delete instrument');
        console.error('Error deleting instrument:', err);
      }
    });
  }

  toggleEnabled(instrument: Instrument | InstrumentDetail): void {
    if (!this.isStaff()) {
      this.toastService.error('Only staff members can update instruments');
      return;
    }

    this.instrumentService.patchInstrument(instrument.id, {
      enabled: !instrument.enabled
    }).subscribe({
      next: (updated) => {
        this.instruments.update(instruments =>
          instruments.map(i => i.id === updated.id ? updated : i)
        );
        if (this.selectedInstrument()?.id === updated.id) {
          this.loadInstrumentDetails(instrument);
        }
        this.applyFilter();
        this.toastService.success(`Instrument ${updated.enabled ? 'enabled' : 'disabled'}`);
      },
      error: (err) => {
        this.toastService.error('Failed to update instrument');
        console.error('Error updating instrument:', err);
      }
    });
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadInstruments();
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadInstruments();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadInstruments();
    }
  }

  openAddSupportInfoModal(instrument: Instrument | InstrumentDetail): void {
    const modalRef = this.modal.open(SupportInformationModal, { scrollable: true, size: 'lg' });
    modalRef.componentInstance.instrumentId = instrument.id;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadInstrumentDetails(instrument);
      }
    });
  }

  openEditSupportInfoModal(instrument: Instrument | InstrumentDetail): void {
    if (!this.selectedSupportInfo()) return;

    const modalRef = this.modal.open(SupportInformationModal, { scrollable: true, size: 'lg' });
    modalRef.componentInstance.instrumentId = instrument.id;
    modalRef.componentInstance.supportInformation = this.selectedSupportInfo();
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadInstrumentDetails(instrument);
      }
    });
  }

  openCreateInstrumentModal(): void {
    const modalRef = this.modal.open(InstrumentEditModal, { scrollable: true, size: 'lg' });
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.currentPage.set(1);
        this.loadInstruments();
      }
    });
  }

  openEditInstrumentModal(instrument: Instrument | InstrumentDetail): void {
    const modalRef = this.modal.open(InstrumentEditModal, { scrollable: true, size: 'lg' });

    let instrumentData: Instrument;
    if ('supportInformation' in instrument && Array.isArray(instrument.supportInformation) && instrument.supportInformation.length > 0) {
      const firstItem = instrument.supportInformation[0];
      if (typeof firstItem === 'object' && firstItem !== null && 'id' in firstItem) {
        const detailInstrument = instrument as InstrumentDetail;
        instrumentData = {
          id: detailInstrument.id,
          instrumentName: detailInstrument.instrumentName,
          instrumentDescription: detailInstrument.instrumentDescription,
          image: detailInstrument.image,
          enabled: detailInstrument.enabled,
          remoteId: detailInstrument.remoteId,
          remoteHost: detailInstrument.remoteHost,
          remoteHostName: detailInstrument.remoteHostName,
          maxDaysAheadPreApproval: detailInstrument.maxDaysAheadPreApproval,
          maxDaysWithinUsagePreApproval: detailInstrument.maxDaysWithinUsagePreApproval,
          supportInformation: detailInstrument.supportInformation?.map(si => si.id),
          supportInformationCount: detailInstrument.supportInformationCount,
          lastWarrantyNotificationSent: detailInstrument.lastWarrantyNotificationSent,
          lastMaintenanceNotificationSent: detailInstrument.lastMaintenanceNotificationSent,
          daysBeforeWarrantyNotification: detailInstrument.daysBeforeWarrantyNotification,
          daysBeforeMaintenanceNotification: detailInstrument.daysBeforeMaintenanceNotification,
          acceptsBookings: detailInstrument.acceptsBookings,
          allowOverlappingBookings: detailInstrument.allowOverlappingBookings,
          user: detailInstrument.user,
          ownerUsername: detailInstrument.ownerUsername,
          isVaulted: detailInstrument.isVaulted,
          metadataTable: detailInstrument.metadataTable,
          metadataTableName: detailInstrument.metadataTableName,
          metadataTableId: detailInstrument.metadataTableId,
          maintenanceOverdue: detailInstrument.maintenanceOverdue,
          createdAt: detailInstrument.createdAt,
          updatedAt: detailInstrument.updatedAt
        };
      } else {
        instrumentData = instrument as Instrument;
      }
    } else {
      instrumentData = instrument as Instrument;
    }

    modalRef.componentInstance.instrument = instrumentData;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadInstruments();
        if (this.selectedInstrument()?.id === result.id) {
          this.loadInstrumentDetails(instrument);
        }
      }
    });
  }

  openContactsManagementModal(): void {
    const modalRef = this.modal.open(ContactsManagementModal, { size: 'xl' });
    modalRef.closed.subscribe(() => {
      if (this.selectedInstrument()) {
        this.loadInstrumentDetails(this.selectedInstrument()!);
      }
    });
  }

  openMetadataModal(): void {
    const instrument = this.selectedInstrument();
    if (!instrument?.metadataTableId) {
      this.toastService.error('No metadata associated with this instrument');
      return;
    }

    const modalRef = this.modal.open(InstrumentMetadataModal, { size: 'lg', scrollable: true });
    modalRef.componentInstance.instrumentId = instrument.id;
    modalRef.componentInstance.metadataTableId = instrument.metadataTableId;
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadMetadataColumns(instrument.id);
        }
      },
      () => {
        // Modal dismissed (e.g., backdrop click or ESC)
      }
    );
  }

  openAnnotationsModal(): void {
    const instrument = this.selectedInstrument();
    if (!instrument) {
      this.toastService.error('No instrument selected');
      return;
    }

    const modalRef = this.modal.open(InstrumentAnnotationsModal, { size: 'lg', scrollable: true });
    modalRef.componentInstance.instrument = instrument;
    const permission = this.userPermission();
    modalRef.componentInstance.canManage = permission?.canManage || this.isStaff();
  }

  openPermissionsModal(): void {
    const instrument = this.selectedInstrument();
    if (!instrument) {
      this.toastService.error('No instrument selected');
      return;
    }

    const modalRef = this.modal.open(InstrumentPermissionModal, { size: 'lg', scrollable: true });
    modalRef.componentInstance.instrument = instrument;

    modalRef.result.then(
      (result) => {
        if (result) {
          this.toastService.success('Permissions updated successfully');
        }
      },
      () => {}
    );
  }

  loadMaintenanceLogs(instrumentId: number): void {
    this.loadingMaintenanceLogs.set(true);
    const params: any = {
      instrument: instrumentId,
      limit: this.maintenanceLogsPageSize,
      offset: (this.maintenanceLogsPage() - 1) * this.maintenanceLogsPageSize,
      ordering: '-maintenanceDate'
    };

    if (this.maintenanceFilterType()) {
      params.maintenanceType = this.maintenanceFilterType();
    }

    if (this.maintenanceFilterStatus()) {
      params.status = this.maintenanceFilterStatus();
    }

    this.maintenanceService.getMaintenanceLogs(params).subscribe({
      next: (response) => {
        this.maintenanceLogs.set(response.results);
        this.maintenanceLogsTotal.set(response.count || 0);
        this.loadMaintenanceLogDocumentCounts(response.results);
        this.loadingMaintenanceLogs.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load maintenance logs');
        console.error('Error loading maintenance logs:', err);
        this.loadingMaintenanceLogs.set(false);
      }
    });
  }

  loadMaintenanceLogDocumentCounts(logs: MaintenanceLog[]): void {
    if (logs.length === 0) {
      this.maintenanceLogDocumentCounts.set(new Map());
      return;
    }

    const countRequests = logs.map(log =>
      this.maintenanceService.getAnnotationsForMaintenanceLog(log.id)
    );

    forkJoin(countRequests).subscribe({
      next: (responses) => {
        const countsMap = new Map<number, number>();
        logs.forEach((log, index) => {
          countsMap.set(log.id, responses[index].count || 0);
        });
        this.maintenanceLogDocumentCounts.set(countsMap);
      },
      error: (err) => {
        console.error('Error loading document counts:', err);
      }
    });
  }

  onMaintenanceFilterChange(): void {
    this.maintenanceLogsPage.set(1);
    const instrument = this.selectedInstrument();
    if (instrument) {
      this.loadMaintenanceLogs(instrument.id);
    }
  }

  onMaintenancePageChange(page: number): void {
    this.maintenanceLogsPage.set(page);
    const instrument = this.selectedInstrument();
    if (instrument) {
      this.loadMaintenanceLogs(instrument.id);
    }
  }

  toggleMaintenanceLogDetails(logId: number): void {
    if (this.expandedMaintenanceLogId() === logId) {
      this.expandedMaintenanceLogId.set(null);
    } else {
      this.expandedMaintenanceLogId.set(logId);
    }
  }

  openCreateMaintenanceLogModal(): void {
    const instrument = this.selectedInstrument();
    if (!instrument) {
      this.toastService.error('No instrument selected');
      return;
    }

    if (!this.canManageInstrument()) {
      this.toastService.error('You do not have permission to create maintenance logs');
      return;
    }

    const modalRef = this.modal.open(MaintenanceLogEditModal, { size: 'lg', scrollable: true });
    modalRef.componentInstance.instrumentId = instrument.id;
    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadMaintenanceLogs(instrument.id);
      }
    });
  }

  openEditMaintenanceLogModal(maintenanceLog: MaintenanceLog): void {
    if (!this.canManageInstrument()) {
      this.toastService.error('You do not have permission to edit maintenance logs');
      return;
    }

    const modalRef = this.modal.open(MaintenanceLogEditModal, { size: 'lg', scrollable: true });
    modalRef.componentInstance.maintenanceLog = maintenanceLog;
    modalRef.closed.subscribe((result) => {
      if (result && this.selectedInstrument()) {
        this.loadMaintenanceLogs(this.selectedInstrument()!.id);
      }
    });
  }

  deleteMaintenanceLog(maintenanceLog: MaintenanceLog): void {
    if (!this.canManageInstrument()) {
      this.toastService.error('You do not have permission to delete maintenance logs');
      return;
    }

    if (!confirm('Are you sure you want to delete this maintenance log?')) {
      return;
    }

    this.maintenanceService.deleteMaintenanceLog(maintenanceLog.id).subscribe({
      next: () => {
        this.toastService.success('Maintenance log deleted successfully');
        if (this.selectedInstrument()) {
          this.loadMaintenanceLogs(this.selectedInstrument()!.id);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to delete maintenance log');
        console.error('Error deleting maintenance log:', err);
      }
    });
  }

  openMaintenanceLogAnnotationsModal(maintenanceLog: MaintenanceLog): void {
    const modalRef = this.modal.open(MaintenanceLogAnnotationsModal, { size: 'lg', scrollable: true });
    modalRef.componentInstance.maintenanceLog = maintenanceLog;
    modalRef.componentInstance.canManage = this.canManageInstrument();
  }

  loadBookings(instrumentId: number): void {
    this.loadingBookings.set(true);
    const params: any = {
      instrument: instrumentId,
      limit: this.bookingsPageSize,
      offset: (this.bookingsPage() - 1) * this.bookingsPageSize,
      ordering: '-timeStarted'
    };

    this.instrumentUsageService.getInstrumentUsage(params).subscribe({
      next: (response) => {
        this.bookings.set(response.results);
        this.bookingsTotal.set(response.count || 0);
        this.loadingBookings.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load bookings');
        console.error('Error loading bookings:', err);
        this.loadingBookings.set(false);
      }
    });
  }

  onBookingsPageChange(page: number): void {
    this.bookingsPage.set(page);
    const instrument = this.selectedInstrument();
    if (instrument) {
      this.loadBookings(instrument.id);
    }
  }

  openCreateBookingModal(): void {
    const instrument = this.selectedInstrument();
    if (!instrument) return;

    const modalRef = this.modal.open(InstrumentUsageModal, { size: 'md' });
    modalRef.componentInstance.instrument = instrument;
    modalRef.result.then(
      () => {
        this.loadBookings(instrument.id);
      },
      () => {}
    );
  }

  openEditBookingModal(booking: InstrumentUsage): void {
    const instrument = this.selectedInstrument();
    if (!instrument) return;

    const modalRef = this.modal.open(InstrumentUsageModal, { size: 'md' });
    modalRef.componentInstance.instrument = instrument;
    modalRef.componentInstance.usage = booking;
    modalRef.result.then(
      () => {
        this.loadBookings(instrument.id);
      },
      () => {}
    );
  }

  approveBooking(booking: InstrumentUsage): void {
    this.instrumentUsageService.patchInstrumentUsage(booking.id, { approved: true }).subscribe({
      next: () => {
        this.toastService.success('Booking approved successfully');
        const instrument = this.selectedInstrument();
        if (instrument) {
          this.loadBookings(instrument.id);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to approve booking');
        console.error('Error approving booking:', err);
      }
    });
  }

  unapproveBooking(booking: InstrumentUsage): void {
    this.instrumentUsageService.patchInstrumentUsage(booking.id, { approved: false }).subscribe({
      next: () => {
        this.toastService.success('Booking unapproved successfully');
        const instrument = this.selectedInstrument();
        if (instrument) {
          this.loadBookings(instrument.id);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to unapprove booking');
        console.error('Error unapproving booking:', err);
      }
    });
  }

  deleteBooking(booking: InstrumentUsage): void {
    if (!confirm('Are you sure you want to delete this booking?')) {
      return;
    }

    this.instrumentUsageService.deleteInstrumentUsage(booking.id).subscribe({
      next: () => {
        this.toastService.success('Booking deleted successfully');
        const instrument = this.selectedInstrument();
        if (instrument) {
          this.loadBookings(instrument.id);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to delete booking');
        console.error('Error deleting booking:', err);
      }
    });
  }

  calculateDuration(booking: InstrumentUsage): number | null {
    if (!booking.timeStarted) return null;

    const startTime = new Date(booking.timeStarted);
    const endTime = booking.timeEnded ? new Date(booking.timeEnded) : new Date();

    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    return Math.round(durationHours * 100) / 100;
  }
}
