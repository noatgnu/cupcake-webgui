import { Component, OnInit, OnDestroy, Input, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  MetadataTable,
  MetadataColumn,
  MetadataTableService,
  MetadataColumnService,
  MetadataValueEditModal,
  MetadataValueEditConfig,
  ChunkedUploadService,
  AsyncTaskUIService,
  ColumnEditModal,
  ExcelExportModalComponent,
  ExcelExportOptions,
  ColumnType,
  SearchReplaceModal,
  SearchReplaceConfig,
  MetadataValidationModal,
  SamplePool,
  SamplePoolService,
  SamplePoolCreateModal,
  SamplePoolEditModal,
  SamplePoolDetailsModal,
  MetadataColumnAutofillModal,
  MetadataColumnAutofillConfig,
  MetadataColumnHistoryModal,
  ColumnHistoryModalConfig
} from '@noatgnu/cupcake-vanilla';
import { ToastService, MetadataExportRequest, MetadataValidationConfig, SiteConfigService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-metadata-table-editor',
  standalone: true,
  imports: [CommonModule, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu],
  templateUrl: './metadata-table-editor.html',
  styleUrl: './metadata-table-editor.scss'
})
export class MetadataTableEditor implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() tableId!: number;
  @Input() showStaffOnlyFilter = false;
  @Input() readonlyMode = false;
  @Input() canEditStaffOnly = false;
  @ViewChild('sdrfFileInput') sdrfFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('excelFileInput') excelFileInput!: ElementRef<HTMLInputElement>;

  isLoading = signal(false);
  table = signal<MetadataTable | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);
  columnFilter = signal('');
  staffOnlyFilter = signal<'all' | 'user' | 'staff'>('all');
  selectedColumnIds = signal<Set<number>>(new Set());

  userColumns = computed(() => {
    const columns = this.table()?.columns || [];
    const filter = this.columnFilter().toLowerCase();
    const staffFilter = this.staffOnlyFilter();

    return columns
      .filter(col => {
        if (staffFilter === 'user') return !col.staffOnly;
        if (staffFilter === 'staff') return col.staffOnly;
        return true;
      })
      .filter(col => !filter || col.name.toLowerCase().includes(filter))
      .sort((a, b) => (a.columnPosition || 0) - (b.columnPosition || 0));
  });

  hasPools = computed(() => {
    const table = this.table();
    return table?.samplePools && table.samplePools.length > 0;
  });

  sortedPools = computed(() => {
    const pools = this.table()?.samplePools || [];
    return [...pools].sort((a, b) => a.poolName.localeCompare(b.poolName));
  });

  maxUploadSizeText = computed(() => {
    const maxSize = this.siteConfigService.getMaxChunkedUploadSize();
    return this.siteConfigService.formatFileSize(maxSize);
  });

  poolTableRows = computed(() => {
    const table = this.table();
    if (!table || !this.hasPools() || this.userColumns().length === 0) return [];

    const rows: any[] = [];
    this.sortedPools().forEach(pool => {
      const row: any = {
        _poolName: pool.poolName,
        _poolId: pool.id,
        _poolData: pool
      };

      this.userColumns().forEach(column => {
        let value = '';
        const poolColumn = pool.metadataColumns?.find((pc: any) =>
          (pc.id && column.id && pc.id === column.id) || pc.name === column.name
        );
        if (poolColumn) {
          value = poolColumn.value || '';
        }
        row[`col_${column.id}`] = value;
      });

      rows.push(row);
    });

    return rows;
  });

  tableRows = computed(() => {
    const table = this.table();
    const columns = this.userColumns();
    if (!table || columns.length === 0) return [];

    const rows: any[] = [];
    for (let i = 0; i < table.sampleCount; i++) {
      const sampleIndex = i + 1;
      const row: any = { _sampleIndex: sampleIndex };

      columns.forEach(column => {
        const value = this.getSampleColumnValue(column, sampleIndex);
        row[`col_${column.id}`] = value;
      });

      rows.push(row);
    }

    return rows;
  });

  paginatedRows = computed(() => {
    const rows = this.tableRows();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    const end = start + size;
    return rows.slice(start, end);
  });

  totalPages = computed(() => {
    const rows = this.tableRows();
    const size = this.pageSize();
    return Math.ceil(rows.length / size);
  });

  allColumnsSelected = computed(() => {
    const columns = this.userColumns();
    const selected = this.selectedColumnIds();
    return columns.length > 0 && columns.every(col => col.id && selected.has(col.id));
  });

  someColumnsSelected = computed(() => {
    const columns = this.userColumns();
    const selected = this.selectedColumnIds();
    return columns.some(col => col.id && selected.has(col.id)) && !this.allColumnsSelected();
  });

  Math = Math;

  constructor(
    private metadataTableService: MetadataTableService,
    private metadataColumnService: MetadataColumnService,
    private chunkedUploadService: ChunkedUploadService,
    private asyncTaskService: AsyncTaskUIService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private samplePoolService: SamplePoolService,
    private siteConfigService: SiteConfigService
  ) {}

  ngOnInit(): void {
    if (this.tableId) {
      this.loadTable(this.tableId);
      this.setupAsyncTaskRefreshListener(this.tableId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupAsyncTaskRefreshListener(tableId: number): void {
    this.asyncTaskService.metadataTableRefresh$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((refreshedTableId: number) => {
      if (refreshedTableId === tableId) {
        console.log(`Import task completed for table ${refreshedTableId}, refreshing table`);
        this.toastService.info('Table data refreshed after import completion');
        this.loadTable(tableId);
      }
    });
  }

  loadTable(id: number): void {
    this.isLoading.set(true);
    this.metadataTableService.getMetadataTable(id).subscribe({
      next: (table) => {
        this.table.set(table);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading metadata table:', err);
        this.toastService.error('Failed to load metadata table');
        this.isLoading.set(false);
      }
    });
  }

  getSampleColumnValue(column: MetadataColumn, sampleIndex: number): string {
    if (!column.modifiers || column.modifiers.length === 0) {
      return column.value || '';
    }

    for (const modifier of column.modifiers) {
      const sampleIndices = this.parseSampleRanges(modifier.samples);
      if (sampleIndices.includes(sampleIndex)) {
        return modifier.value || '';
      }
    }

    return column.value || '';
  }

  parseSampleRanges(samples: string): number[] {
    if (!samples || samples.trim() === '') return [];

    const indices: number[] = [];
    const parts = samples.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(s => parseInt(s.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            indices.push(i);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) {
          indices.push(num);
        }
      }
    }

    return indices;
  }

  canEditColumn(column: MetadataColumn): boolean {
    const table = this.table();
    if (!table || !table.canEdit) return false;
    if (column.staffOnly && !this.canEditStaffOnly) return false;
    return true;
  }

  editSampleColumnValue(column: MetadataColumn, sampleIndex: number): void {
    if (!this.canEditColumn(column) || !column.id) return;
    const table = this.table();
    if (!table) return;

    const currentValue = this.getSampleColumnValue(column, sampleIndex);

    const config: MetadataValueEditConfig = {
      columnId: column.id,
      columnName: column.name,
      columnType: column.type,
      ontologyType: column.ontologyType,
      enableTypeahead: column.enableTypeahead,
      currentValue: currentValue,
      context: 'table',
      tableId: table.id,
      enableMultiSampleEdit: false
    };

    const modalRef = this.modalService.open(MetadataValueEditModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.config = config;

    modalRef.componentInstance.valueSaved.subscribe((value: string) => {
      const requestData = {
        value: value,
        sampleIndices: [sampleIndex],
        valueType: 'sample_specific' as const
      };

      this.metadataColumnService.updateColumnValue(column.id!, requestData).subscribe({
        next: (response) => {
          const currentTable = this.table();
          if (currentTable && currentTable.columns && response.column) {
            const updatedColumns = currentTable.columns.map(col =>
              col.id === column.id ? response.column : col
            );
            this.table.set({ ...currentTable, columns: updatedColumns });
          }
          this.toastService.success('Cell value updated');
          modalRef.componentInstance.onClose();
        },
        error: (error) => {
          console.error('Error updating cell value:', error);
          this.toastService.error('Failed to update cell value');
        }
      });
    });
  }

  editColumnValue(column: MetadataColumn): void {
    if (!this.canEditColumn(column) || !column.id) return;
    const table = this.table();
    if (!table) return;

    const config: MetadataValueEditConfig = {
      columnId: column.id,
      columnName: column.name,
      columnType: column.type,
      ontologyType: column.ontologyType,
      enableTypeahead: column.enableTypeahead,
      currentValue: column.value || '',
      context: 'table',
      tableId: table.id,
      enableMultiSampleEdit: true
    };

    const modalRef = this.modalService.open(MetadataValueEditModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.config = config;

    modalRef.componentInstance.valueSaved.subscribe((value: string) => {
      const requestData = {
        value: value,
        sampleIndices: [],
        valueType: 'default' as const
      };

      this.metadataColumnService.updateColumnValue(column.id!, requestData).subscribe({
        next: (response) => {
          const currentTable = this.table();
          if (currentTable && currentTable.columns && response.column) {
            const updatedColumns = currentTable.columns.map(col =>
              col.id === column.id ? response.column : col
            );
            this.table.set({ ...currentTable, columns: updatedColumns });
          }
          this.toastService.success('Column default value updated');
          this.loadTable(this.tableId);
          modalRef.componentInstance.onClose();
        }
      });
    });
  }

  toggleColumnHidden(column: MetadataColumn): void {
    if (!column.id) return;

    const newHiddenState = !column.hidden;

    this.metadataColumnService.updateMetadataColumn(column.id, { hidden: newHiddenState }).subscribe({
      next: () => {
        this.toastService.success(`Column ${newHiddenState ? 'hidden' : 'shown'}`);
        this.loadTable(this.tableId);
      },
      error: (error: any) => {
        console.error('Error toggling column visibility:', error);
        this.toastService.error('Failed to toggle column visibility');
      }
    });
  }

  editColumnSettings(column: MetadataColumn): void {
    const table = this.table();
    if (!table || !table.canEdit || !column.id) return;

    const modalRef = this.modalService.open(ColumnEditModal, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    modalRef.componentInstance.column = column;
    modalRef.componentInstance.templateId = null;
    modalRef.componentInstance.isEdit = true;

    modalRef.componentInstance.columnSaved.subscribe((columnData: Partial<MetadataColumn>) => {
      this.updateColumnSettings(column.id!, columnData);
      modalRef.componentInstance.onClose();
    });
  }

  openColumnHistory(column: MetadataColumn): void {
    if (!column.id) return;

    const config: ColumnHistoryModalConfig = {
      columnId: column.id,
      columnName: column.displayName || column.name
    };

    const modalRef = this.modalService.open(MetadataColumnHistoryModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.config = config;
  }

  private updateColumnSettings(columnId: number, columnData: Partial<MetadataColumn>): void {
    this.metadataColumnService.patchMetadataColumn(columnId, columnData).subscribe({
      next: (updatedColumn: MetadataColumn) => {
        const currentTable = this.table();
        if (currentTable && currentTable.columns) {
          const updatedColumns = currentTable.columns.map(col =>
            col.id === columnId ? updatedColumn : col
          );
          this.table.set({ ...currentTable, columns: updatedColumns });
        }
        this.toastService.success(`Column "${updatedColumn.name}" updated successfully!`);
        this.loadTable(this.tableId);
      },
      error: (error: any) => {
        console.error('Error updating column settings:', error);
        this.toastService.error('Failed to update column settings');
      }
    });
  }

  toggleColumnSelection(columnId: number): void {
    const selected = new Set(this.selectedColumnIds());
    if (selected.has(columnId)) {
      selected.delete(columnId);
    } else {
      selected.add(columnId);
    }
    this.selectedColumnIds.set(selected);
  }

  toggleAllColumns(): void {
    const columns = this.userColumns();
    if (this.allColumnsSelected()) {
      this.selectedColumnIds.set(new Set());
    } else {
      const allIds = new Set(columns.filter(col => col.id).map(col => col.id!));
      this.selectedColumnIds.set(allIds);
    }
  }

  bulkToggleStaffOnly(staffOnly: boolean): void {
    const selected = this.selectedColumnIds();
    if (selected.size === 0) {
      this.toastService.error('Please select columns first');
      return;
    }

    const columnIds = Array.from(selected);

    this.metadataTableService.bulkUpdateStaffOnly(this.tableId, {
      columnIds,
      staffOnly
    }).subscribe({
      next: (result) => {
        this.toastService.success(`Updated ${result.updatedCount} column(s)`);
        if (result.permissionDeniedColumns && result.permissionDeniedColumns.length > 0) {
          this.toastService.error(`Permission denied for ${result.permissionDeniedColumns.length} column(s)`);
        }
        this.selectedColumnIds.set(new Set());
        this.loadTable(this.tableId);
      },
      error: (error) => {
        console.error('Error bulk updating columns:', error);
        this.toastService.error('Failed to update columns');
      }
    });
  }

  bulkDeleteColumns(): void {
    const selected = this.selectedColumnIds();
    if (selected.size === 0) {
      this.toastService.error('Please select columns first');
      return;
    }

    const columnIds = Array.from(selected);
    const columnNames = this.userColumns()
      .filter(col => col.id && selected.has(col.id))
      .map(col => col.name)
      .join(', ');

    if (!confirm(`Are you sure you want to delete ${columnIds.length} column(s)?\n\n${columnNames}`)) {
      return;
    }

    this.metadataTableService.bulkDeleteColumns(this.tableId, {
      columnIds
    }).subscribe({
      next: (result) => {
        this.toastService.success(`Deleted ${result.deletedCount} column(s)`);
        if (result.permissionDeniedColumns && result.permissionDeniedColumns.length > 0) {
          this.toastService.error(`Permission denied for ${result.permissionDeniedColumns.length} column(s)`);
        }
        this.selectedColumnIds.set(new Set());
        this.loadTable(this.tableId);
      },
      error: (error) => {
        console.error('Error bulk deleting columns:', error);
        this.toastService.error('Failed to delete columns');
      }
    });
  }

  removeColumn(column: MetadataColumn): void {
    if (!column.id) return;

    if (!confirm(`Are you sure you want to remove the column "${column.name}"?`)) {
      return;
    }

    this.metadataColumnService.deleteMetadataColumn(column.id).subscribe({
      next: () => {
        this.toastService.success('Column removed');
        this.loadTable(this.tableId);
      },
      error: (error: any) => {
        console.error('Error removing column:', error);
        this.toastService.error('Failed to remove column');
      }
    });
  }

  openAddColumnModal(): void {
    const modalRef = this.modalService.open(ColumnEditModal, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    modalRef.componentInstance.column = null;
    modalRef.componentInstance.templateId = null;
    modalRef.componentInstance.isEdit = false;

    modalRef.componentInstance.columnSaved.subscribe((columnData: Partial<MetadataColumn>) => {
      this.addColumnWithAutoReorder(columnData);
      modalRef.componentInstance.onClose();
    });
  }

  private addColumnWithAutoReorder(columnData: Partial<MetadataColumn>): void {
    const currentTable = this.table();
    if (!currentTable) {
      this.toastService.error('No table selected');
      return;
    }

    this.isLoading.set(true);

    this.metadataTableService.addColumnWithAutoReorder(currentTable.id, {
      columnData: columnData
    }).subscribe({
      next: (response: { message: string; column: MetadataColumn; reordered: boolean; schemaIdsUsed: number[] }) => {
        const updatedColumns = [...(currentTable.columns || []), response.column];
        this.table.set({ ...currentTable, columns: updatedColumns });

        let message = `Column "${response.column.name}" added successfully!`;
        if (response.reordered) {
          message += ` Columns reordered using ${response.schemaIdsUsed.length} schema(s).`;
        }

        this.toastService.success(message);
        this.loadTable(currentTable.id);
      },
      error: (error: any) => {
        console.error('Error adding column:', error);
        this.toastService.error('Failed to add column');
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }

  triggerSdrfFileInput(): void {
    this.sdrfFileInput.nativeElement.click();
  }

  triggerExcelFileInput(): void {
    this.excelFileInput.nativeElement.click();
  }

  importSdrf(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const table = this.table();
    if (!table) return;

    if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.tsv')) {
      this.toastService.error('Please select a valid SDRF file (.txt or .tsv)');
      input.value = '';
      return;
    }

    if (confirm(`Import SDRF data into table "${table.name}"?\n\nThis will add new columns and may modify existing data.`)) {
      input.value = '';
      this.isLoading.set(true);

      this.chunkedUploadService.uploadFileInChunks(
        file,
        1024 * 1024,
        {
          metadataTableId: this.tableId,
          createPools: true,
          replaceExisting: false,
          onProgress: (progress: number) => {
            console.log(`SDRF upload progress: ${Math.round(progress)}%`);
          }
        }
      ).subscribe({
        next: (result: any) => {
          this.isLoading.set(false);

          if (result?.taskId) {
            this.toastService.success(`SDRF import task queued successfully! Task ID: ${result.taskId}`);
            this.asyncTaskService.monitorTask(result.taskId);
          } else {
            this.toastService.success('SDRF file imported successfully!');
            this.loadTable(this.tableId);
          }
        },
        error: (error: any) => {
          this.isLoading.set(false);
          console.error('Error importing SDRF:', error);
          const errorMsg = error?.error?.detail || error?.error?.message || 'Failed to import SDRF file';
          this.toastService.error(errorMsg);
        }
      });
    } else {
      input.value = '';
    }
  }

  importExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const table = this.table();
    if (!table) return;

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      this.toastService.error('Please select a valid Excel file (.xlsx or .xls)');
      input.value = '';
      return;
    }

    if (confirm(`Import Excel data into table "${table.name}"?\n\nThis will add new columns and may modify existing data.`)) {
      input.value = '';
      this.isLoading.set(true);

      this.chunkedUploadService.uploadFileInChunks(
        file,
        1024 * 1024,
        {
          metadataTableId: this.tableId,
          createPools: true,
          replaceExisting: false,
          onProgress: (progress: number) => {
            console.log(`Excel upload progress: ${Math.round(progress)}%`);
          }
        }
      ).subscribe({
        next: (result: any) => {
          this.isLoading.set(false);

          if (result?.taskId) {
            this.toastService.success(`Excel import task queued successfully! Task ID: ${result.taskId}`);
            this.asyncTaskService.monitorTask(result.taskId);
          } else {
            this.toastService.success('Excel file imported successfully!');
            this.loadTable(this.tableId);
          }
        },
        error: (error: any) => {
          this.isLoading.set(false);
          console.error('Error importing Excel:', error);
          const errorMsg = error?.error?.detail || error?.error?.message || 'Failed to import Excel file';
          this.toastService.error(errorMsg);
        }
      });
    } else {
      input.value = '';
    }
  }

  exportToSdrf(format: 'sdrf' | 'excel' = 'sdrf'): void {
    if (format === 'excel') {
      this.openExcelExportModal();
      return;
    }

    const table = this.table();
    if (!table) return;

    const columnIds = this.userColumns()
      .map(col => col.id)
      .filter((id): id is number => id !== undefined);

    const request: MetadataExportRequest = {
      metadataTableId: this.tableId,
      metadataColumnIds: columnIds,
      sampleNumber: table.sampleCount || 1,
      includePools: false
    };

    this.asyncTaskService.queueSdrfExport(request).subscribe({
      next: (result: any) => {
        this.toastService.success(`SDRF export queued successfully! Task ID: ${result.taskId}`);
      },
      error: (error: any) => {
        console.error('Error exporting SDRF:', error);
        this.toastService.error('Failed to export SDRF');
      }
    });
  }

  openExcelExportModal(): void {
    const modalRef = this.modalService.open(ExcelExportModalComponent, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.tableId = this.tableId;

    modalRef.result.then((options: ExcelExportOptions) => {
      if (options) {
        const table = this.table();
        if (!table) return;

        const columnIds = this.userColumns()
          .map(col => col.id)
          .filter((id): id is number => id !== undefined);

        const request: MetadataExportRequest = {
          metadataTableId: this.tableId,
          metadataColumnIds: columnIds,
          sampleNumber: table.sampleCount || 1,
          includePools: options.includePools || false
        };

        this.asyncTaskService.queueExcelExport(request).subscribe({
          next: (result: any) => {
            this.toastService.success(`Excel export queued successfully! Task ID: ${result.taskId}`);
          },
          error: (error: any) => {
            console.error('Error exporting Excel:', error);
            this.toastService.error('Failed to export Excel');
          }
        });
      }
    }).catch(() => {});
  }

  openValidationModal(): void {
    const table = this.table();
    if (!table || !table.id) return;

    const config: MetadataValidationConfig = {
      metadataTableId: table.id,
      metadataTableName: table.name
    };

    const modalRef = this.modalService.open(MetadataValidationModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.config = config;

    modalRef.result.then((result: { success: boolean; task_id: string; message: string }) => {
      if (result.success && result.task_id) {
        this.asyncTaskService.monitorTask(result.task_id);
      }
    }).catch(() => {});
  }

  openSearchReplaceModal(): void {
    const table = this.table();
    if (!table) return;

    const config: SearchReplaceConfig = {
      context: 'table',
      tableId: table.id,
      tableName: table.name,
      columns: this.userColumns()
    };

    const modalRef = this.modalService.open(SearchReplaceModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.config = config;

    modalRef.result.then((result: { action: string; data: any }) => {
      if (result.action === 'replace') {
        this.performSearchReplace(result.data);
      }
    }).catch(() => {});
  }

  private performSearchReplace(data: {
    oldValue: string;
    newValue: string;
    columnId?: number;
    columnName?: string;
    updatePools?: boolean;
  }): void {
    const table = this.table();
    if (!table || !table.id) return;

    this.isLoading.set(true);
    this.toastService.info('Performing search and replace...');

    this.metadataTableService.replaceColumnValue(table.id, {
      oldValue: data.oldValue,
      newValue: data.newValue,
      columnId: data.columnId,
      columnName: data.columnName,
      updatePools: data.updatePools
    }).subscribe({
      next: (result) => {
        this.isLoading.set(false);
        this.toastService.success(
          `Successfully replaced "${result.oldValue}" with "${result.newValue}". ` +
          `Checked ${result.columnsChecked} columns, updated ${result.columnsUpdated} columns.`
        );
        this.loadTable(this.tableId);
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Error performing search and replace:', error);
        this.toastService.error('Failed to perform search and replace');
      }
    });
  }

  onColumnFilterChange(value: string): void {
    this.columnFilter.set(value);
  }

  clearColumnFilter(): void {
    this.columnFilter.set('');
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  previousPage(): void {
    const current = this.currentPage();
    if (current > 1) {
      this.currentPage.set(current - 1);
    }
  }

  nextPage(): void {
    const current = this.currentPage();
    const total = this.totalPages();
    if (current < total) {
      this.currentPage.set(current + 1);
    }
  }

  getColumnTypeIcon(column: MetadataColumn): string {
    const type = column.type?.toLowerCase() || '';
    if (type.includes('characteristics')) return 'bi-tags';
    if (type.includes('factor') && type.includes('value')) return 'bi-sliders';
    if (type.includes('comment')) return 'bi-chat-left-text';
    if (type.includes('source') && type.includes('name')) return 'bi-diagram-3';
    if (type === ColumnType.SPECIAL.toLowerCase()) return 'bi-star';
    return 'bi-circle';
  }

  getColumnTypeClass(column: MetadataColumn): string {
    const type = column.type?.toLowerCase() || '';
    if (type.includes('characteristics')) return 'text-primary';
    if (type.includes('factor') && type.includes('value')) return 'text-success';
    if (type.includes('comment')) return 'text-info';
    if (type.includes('source') && type.includes('name')) return 'text-warning';
    if (type === ColumnType.SPECIAL.toLowerCase()) return 'text-danger';
    return 'text-muted';
  }

  getColumnHeaderClass(column: MetadataColumn): string {
    let baseClass = '';
    const type = column.type?.toLowerCase() || '';
    if (type.includes('characteristics')) baseClass = 'bg-primary-subtle text-primary-emphasis';
    else if (type.includes('factor') && type.includes('value')) baseClass = 'bg-success-subtle text-success-emphasis';
    else if (type.includes('comment')) baseClass = 'bg-info-subtle text-info-emphasis';
    else if (type.includes('source') && type.includes('name')) baseClass = 'bg-warning-subtle text-warning-emphasis';
    else if (type === ColumnType.SPECIAL.toLowerCase()) baseClass = 'bg-danger-subtle text-danger-emphasis';
    else baseClass = 'bg-body-secondary text-body';

    if (column.hidden) {
      baseClass += ' opacity-50 text-decoration-line-through';
    }

    return baseClass;
  }

  createPool(): void {
    const table = this.table();
    if (!table || !table.canEdit) return;

    const modalRef = this.modalService.open(SamplePoolCreateModal, {
      size: 'xl',
      backdrop: 'static'
    });

    modalRef.componentInstance.metadataTable = table;

    modalRef.componentInstance.poolCreated.subscribe((createdPool: SamplePool) => {
      this.loadTable(this.tableId);
      this.toastService.success(`Pool "${createdPool.poolName}" created successfully!`);
    });

    modalRef.result.catch(() => {});
  }

  editPool(pool: SamplePool): void {
    const table = this.table();
    if (!table || !table.canEdit) return;

    const modalRef = this.modalService.open(SamplePoolEditModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.pool = pool;
    modalRef.componentInstance.maxSampleCount = table.sampleCount;

    modalRef.componentInstance.poolSaved.subscribe((updatedPool: SamplePool) => {
      this.loadTable(this.tableId);
      this.toastService.success(`Pool "${updatedPool.poolName}" updated successfully!`);
    });
  }

  viewPoolDetails(pool: SamplePool): void {
    const modalRef = this.modalService.open(SamplePoolDetailsModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.pool = pool;
  }

  deletePool(pool: SamplePool): void {
    const table = this.table();
    if (!table || !pool.id) return;

    const confirmMessage = `Are you sure you want to delete the pool "${pool.poolName}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.samplePoolService.deleteSamplePool(pool.id).subscribe({
        next: () => {
          this.loadTable(this.tableId);
          this.toastService.success(`Pool "${pool.poolName}" deleted successfully!`);
        },
        error: (error) => {
          console.error('Error deleting pool:', error);
          this.toastService.error(`Failed to delete pool "${pool.poolName}"`);
        }
      });
    }
  }

  editPoolColumnValue(pool: SamplePool, column: MetadataColumn): void {
    const table = this.table();
    if (!table || !table.canEdit) return;

    const poolColumn = pool.metadataColumns?.find(pc => pc.name === column.name);
    if (!poolColumn || !poolColumn.id) return;

    const config: MetadataValueEditConfig = {
      columnId: poolColumn.id,
      columnName: poolColumn.name,
      columnType: poolColumn.type,
      ontologyType: poolColumn.ontologyType,
      enableTypeahead: column.enableTypeahead,
      currentValue: poolColumn.value || '',
      context: 'pool',
      tableId: table.id,
      poolId: pool.id
    };

    const modalRef = this.modalService.open(MetadataValueEditModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.config = config;
    modalRef.componentInstance.valueSaved.subscribe((newValue: string) => {
      const currentTable = this.table();
      if (currentTable && currentTable.samplePools) {
        const updatedPools = currentTable.samplePools.map(p => {
          if (p.id === pool.id) {
            const updatedMetadataColumns = p.metadataColumns.map((mc: MetadataColumn) =>
              mc.id === poolColumn.id ? { ...mc, value: newValue } : mc
            );
            return { ...p, metadataColumns: updatedMetadataColumns };
          }
          return p;
        });
        this.table.set({ ...currentTable, samplePools: updatedPools });
      }

      this.toastService.success('Pool column value updated successfully!');
      modalRef.componentInstance.onClose();
    });
  }

  openAutofillModal(column: MetadataColumn): void {
    const table = this.table();
    if (!table || !table.canEdit || !column.id) return;

    const config: MetadataColumnAutofillConfig = {
      column: column,
      metadataTableId: table.id,
      sampleCount: table.sampleCount
    };

    const modalRef = this.modalService.open(MetadataColumnAutofillModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.config = config;

    modalRef.result.then((result: { success: boolean }) => {
      if (result.success) {
        this.toastService.success('Column values auto-filled successfully!');
        this.loadTable(this.tableId);
      }
    }).catch(() => {});
  }
}
