import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, catchError, debounceTime, distinctUntilChanged, tap, switchMap, map } from 'rxjs';
import {
  MetadataColumnTemplateService,
  MetadataValueEditModal,
  OntologySearchService,
  type OntologySuggestResponse,
  type MetadataColumn,
  type MetadataColumnTemplate,
  type MetadataValueEditConfig,
  type OntologyType,
  type OntologySuggestion,
  type OntologyCustomFilter,
  OFFICIAL_SDRF_COLUMNS,
  type SdrfColumnConfig,
  OntologyType as OntologyTypeEnum,
  MSTermType
} from '@noatgnu/cupcake-vanilla';
import { ToastService } from '@noatgnu/cupcake-core';
import { InstrumentService } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-instrument-metadata-modal',
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './instrument-metadata-modal.html',
  styleUrl: './instrument-metadata-modal.scss'
})
export class InstrumentMetadataModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private instrumentService = inject(InstrumentService);
  private metadataColumnTemplateService = inject(MetadataColumnTemplateService);
  private ontologySearchService = inject(OntologySearchService);
  private modalService = inject(NgbModal);
  private toastService = inject(ToastService);

  instrumentId?: number;
  metadataTableId?: number;

  metadataFields = signal<MetadataColumn[]>([]);
  templates = signal<MetadataColumnTemplate[]>([]);
  officialColumns: SdrfColumnConfig[] = this.getInstrumentRelatedColumns();

  loading = signal(false);
  loadingTemplates = signal(false);
  saving = signal(false);
  isLoadingSuggestions = signal(false);
  searchType = signal<'icontains' | 'istartswith'>('icontains');

  selectedTemplate: MetadataColumnTemplate | null = null;
  selectedOfficialColumn: SdrfColumnConfig | null = null;
  selectedOfficialColumnOntologyType: OntologyType | undefined = undefined;
  selectedOfficialColumnCustomFilters: OntologyCustomFilter | undefined = undefined;
  selectedOfficialColumnEnableTypeahead = false;
  newFieldName = '';
  newFieldValue = '';
  showAddForm = signal(false);
  showOfficialColumns = signal(true);
  showTemplates = signal(false);

  templatePage = signal(1);
  templatePageSize = 10;
  totalTemplates = signal(0);
  totalTemplatePages = signal(0);
  Math = Math;

  private getInstrumentRelatedColumns(): SdrfColumnConfig[] {
    return OFFICIAL_SDRF_COLUMNS;
  }

  ngOnInit(): void {
    if (this.instrumentId) {
      this.loadMetadata();
    }
    this.loadTemplates();
  }

  loadMetadata(): void {
    if (!this.instrumentId) return;

    this.loading.set(true);
    this.instrumentService.getInstrumentMetadata(this.instrumentId).subscribe({
      next: (metadataTable) => {
        const columns = metadataTable.columns || [];
        this.metadataFields.set(columns.filter((col: MetadataColumn) => !col.hidden));
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load metadata');
        console.error('Error loading metadata:', err);
        this.loading.set(false);
      }
    });
  }

  loadTemplates(): void {
    this.loadingTemplates.set(true);
    const offset = (this.templatePage() - 1) * this.templatePageSize;
    this.metadataColumnTemplateService.getMetadataColumnTemplates({
      limit: this.templatePageSize,
      offset: offset,
      isActive: true
    }).subscribe({
      next: (response) => {
        this.templates.set(response.results);
        this.totalTemplates.set(response.count);
        this.totalTemplatePages.set(Math.ceil(response.count / this.templatePageSize));
        this.loadingTemplates.set(false);
      },
      error: (err) => {
        console.error('Error loading templates:', err);
        this.loadingTemplates.set(false);
      }
    });
  }

  nextTemplatePage(): void {
    if (this.templatePage() < this.totalTemplatePages()) {
      this.templatePage.update(p => p + 1);
      this.loadTemplates();
    }
  }

  previousTemplatePage(): void {
    if (this.templatePage() > 1) {
      this.templatePage.update(p => p - 1);
      this.loadTemplates();
    }
  }

  toggleAddForm(): void {
    this.showAddForm.set(!this.showAddForm());
    if (!this.showAddForm()) {
      this.newFieldName = '';
      this.newFieldValue = '';
      this.selectedTemplate = null;
      this.selectedOfficialColumn = null;
      this.selectedOfficialColumnOntologyType = undefined;
      this.selectedOfficialColumnCustomFilters = undefined;
      this.selectedOfficialColumnEnableTypeahead = false;
      this.showOfficialColumns.set(false);
      this.showTemplates.set(false);
    }
  }

  toggleOfficialColumns(): void {
    this.showOfficialColumns.set(!this.showOfficialColumns());
    if (this.showOfficialColumns()) {
      this.showTemplates.set(false);
    }
  }

  toggleTemplates(): void {
    this.showTemplates.set(!this.showTemplates());
    if (this.showTemplates()) {
      this.showOfficialColumns.set(false);
    }
  }

  selectOfficialColumn(column: SdrfColumnConfig): void {
    this.selectedOfficialColumn = column;
    this.newFieldName = column.name;
    const config = this.getDefaultOntologyTypeForColumn(column.name);
    this.selectedOfficialColumnOntologyType = config.ontologyType as OntologyType | undefined;
    this.selectedOfficialColumnCustomFilters = config.customFilters;
    this.selectedOfficialColumnEnableTypeahead = this.shouldEnableTypeaheadForColumn(column.name);
    this.showOfficialColumns.set(false);
  }

  private getDefaultOntologyTypeForColumn(columnName: string): { ontologyType: string; customFilters?: OntologyCustomFilter } {
    const lowerName = columnName.toLowerCase();

    switch (lowerName) {
      case 'characteristics[organism]':
        return { ontologyType: 'species' };
      case 'characteristics[disease]':
        return { ontologyType: 'human_disease' };
      case 'characteristics[organism part]':
        return { ontologyType: 'tissue' };
      case 'characteristics[cell type]':
        return { ontologyType: 'cell_ontology' };
      case 'comment[instrument]':
        return {
          ontologyType: 'ms_unique_vocabularies',
          customFilters: { ms_unique_vocabularies: { term_type: MSTermType.INSTRUMENT } }
        };
      case 'comment[modification parameters]':
        return { ontologyType: 'unimod' };
      case 'comment[ms2 analyzer type]':
        return {
          ontologyType: 'ms_unique_vocabularies',
          customFilters: { ms_unique_vocabularies: { term_type: MSTermType.MASS_ANALYZER_TYPE } }
        };
      case 'comment[cleavage agent details]':
        return {
          ontologyType: 'ms_unique_vocabularies',
          customFilters: { ms_unique_vocabularies: { term_type: MSTermType.CLEAVAGE_AGENT } }
        };
      case 'characteristics[ancestry category]':
        return {
          ontologyType: 'ms_unique_vocabularies',
          customFilters: { ms_unique_vocabularies: { term_type: MSTermType.ANCESTRAL_CATEGORY } }
        };
      case 'characteristics[sex]':
        return {
          ontologyType: 'ms_unique_vocabularies',
          customFilters: { ms_unique_vocabularies: { term_type: MSTermType.SEX } }
        };
      case 'characteristics[developmental stage]':
        return {
          ontologyType: 'ms_unique_vocabularies',
          customFilters: { ms_unique_vocabularies: { term_type: MSTermType.DEVELOPMENTAL_STAGE } }
        };
      case 'comment[label]':
        return {
          ontologyType: 'ms_unique_vocabularies',
          customFilters: { ms_unique_vocabularies: { term_type: MSTermType.SAMPLE_ATTRIBUTE } }
        };
      default:
        return { ontologyType: '' };
    }
  }

  private shouldEnableTypeaheadForColumn(columnName: string): boolean {
    const config = this.getDefaultOntologyTypeForColumn(columnName);
    return config.ontologyType.length > 0;
  }

  selectTemplate(template: MetadataColumnTemplate): void {
    this.selectedTemplate = template;
    this.newFieldName = template.columnName;
    this.newFieldValue = template.defaultValue || '';
    this.showTemplates.set(false);
  }

  get hasOntologyType(): boolean {
    if (this.selectedTemplate) {
      const ontologyType = this.selectedTemplate.ontologyType;
      const enableTypeahead = this.selectedTemplate.enableTypeahead || false;
      return !!(ontologyType && ontologyType.length > 0 && enableTypeahead);
    } else if (this.selectedOfficialColumn) {
      return this.selectedOfficialColumnEnableTypeahead && !!this.selectedOfficialColumnOntologyType;
    }
    return false;
  }

  get ontologyTypeLabel(): string {
    if (this.selectedTemplate) {
      return this.selectedTemplate.ontologyType || '';
    } else if (this.selectedOfficialColumn) {
      return this.selectedOfficialColumnOntologyType || '';
    }
    return '';
  }

  onSearchTypeChange(type: 'icontains' | 'istartswith'): void {
    this.searchType.set(type);
  }

  searchOntology = (text$: Observable<string>): Observable<OntologySuggestion[]> => {
    return text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      tap(() => this.isLoadingSuggestions.set(true)),
      switchMap(term => {
        if (term.length < 2 || !this.hasOntologyType) {
          this.isLoadingSuggestions.set(false);
          return of([]);
        }

        const ontologyType = this.ontologyTypeLabel;
        if (!ontologyType) {
          this.isLoadingSuggestions.set(false);
          return of([]);
        }

        const customFilters = this.selectedTemplate?.customOntologyFilters || this.selectedOfficialColumnCustomFilters;

        return this.ontologySearchService.suggest({
          q: term,
          type: ontologyType,
          match: this.searchType() === 'icontains' ? 'contains' : 'startswith',
          customFilters: customFilters
        }).pipe(
          map((response: OntologySuggestResponse) => response.suggestions || []),
          catchError(() => of([])),
          tap(() => this.isLoadingSuggestions.set(false))
        );
      })
    );
  };

  formatSuggestion = (suggestion: OntologySuggestion): string => {
    return suggestion.displayName || suggestion.value;
  };

  inputFormatter = (suggestion: OntologySuggestion | string): string => {
    if (typeof suggestion === 'string') {
      return suggestion;
    }
    return suggestion.displayName || suggestion.value || '';
  };

  onSuggestionSelected = (event: any): void => {
    if (event.item) {
      const suggestion = event.item as OntologySuggestion;
      let displayValue: string;

      if (suggestion.fullData && suggestion.fullData.name) {
        if (suggestion.fullData.accession) {
          displayValue = `NT=${suggestion.fullData.name};AC=${suggestion.fullData.accession}`;
        } else {
          displayValue = suggestion.fullData.name;
        }
      } else if (suggestion.displayName) {
        displayValue = suggestion.displayName;
      } else if (suggestion.value) {
        displayValue = suggestion.value;
      } else {
        displayValue = String(suggestion);
      }

      this.newFieldValue = displayValue;
    }
  };

  addField(): void {
    if (!this.newFieldName.trim()) {
      this.toastService.error('Field name is required');
      return;
    }

    if (!this.instrumentId || !this.metadataTableId) {
      this.toastService.error('No instrument or metadata table associated');
      return;
    }

    const columnType = this.selectedTemplate?.columnType || this.selectedOfficialColumn?.type || 'characteristics';
    const ontologyType = (this.selectedTemplate?.ontologyType || this.selectedOfficialColumnOntologyType) as OntologyType | undefined;
    const enableTypeahead = this.selectedTemplate?.enableTypeahead || this.selectedOfficialColumnEnableTypeahead;

    let valueToSave = '';
    if (typeof this.newFieldValue === 'string') {
      valueToSave = this.newFieldValue.trim();
    } else if (this.newFieldValue && typeof this.newFieldValue === 'object') {
      const suggestion = this.newFieldValue as any;
      if (suggestion.displayName) {
        valueToSave = suggestion.displayName;
      } else if (suggestion.value) {
        valueToSave = suggestion.value;
      } else {
        valueToSave = String(this.newFieldValue);
      }
    }

    this.saving.set(true);
    this.instrumentService.addMetadataColumn(this.instrumentId, {
      metadataTable: this.metadataTableId,
      name: this.newFieldName.trim(),
      type: columnType,
      value: valueToSave,
      hidden: false,
      ontologyType: ontologyType,
      enableTypeahead: enableTypeahead,
      template: this.selectedTemplate?.id
    }).subscribe({
      next: (response) => {
        this.metadataFields.update(fields => [...fields, response.column]);
        this.toastService.success('Metadata field added');
        this.newFieldName = '';
        this.newFieldValue = '';
        this.selectedTemplate = null;
        this.selectedOfficialColumn = null;
        this.selectedOfficialColumnOntologyType = undefined;
        this.selectedOfficialColumnCustomFilters = undefined;
        this.selectedOfficialColumnEnableTypeahead = false;
        this.showAddForm.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to add metadata field');
        console.error('Error adding metadata field:', err);
        this.saving.set(false);
      }
    });
  }

  editField(field: MetadataColumn): void {
    const config: MetadataValueEditConfig = {
      columnName: field.name,
      columnType: field.type,
      ontologyType: field.ontologyType,
      enableTypeahead: field.enableTypeahead || false,
      currentValue: field.value || '',
      context: 'table',
      tableId: this.metadataTableId
    };

    if (field.template) {
      config.columnId = field.id;
      config.templateId = field.template;
    } else {
      const ontologyConfig = this.getDefaultOntologyTypeForColumn(field.name);
      config.customOntologyFilters = ontologyConfig.customFilters;
    }

    const modalRef = this.modalService.open(MetadataValueEditModal, {
      size: 'lg',
      scrollable: true
    });

    modalRef.componentInstance.config = config;
    modalRef.componentInstance.valueSaved.subscribe((result: string | { value: string; sampleIndices: number[] }) => {
      const newValue = typeof result === 'string' ? result : result.value;
      this.saveFieldValue(field, newValue);
      modalRef.close();
    });
  }

  saveFieldValue(field: MetadataColumn, newValue: string): void {
    if (!field.id || !this.instrumentId) return;

    this.saving.set(true);
    this.instrumentService.updateMetadataValue(this.instrumentId, {
      columnId: field.id,
      value: newValue
    }).subscribe({
      next: (response) => {
        this.metadataFields.update(fields =>
          fields.map(f => f.id === field.id ? { ...f, value: response.newValue } : f)
        );
        this.toastService.success('Metadata updated');
        this.saving.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to update metadata');
        console.error('Error updating metadata:', err);
        this.saving.set(false);
      }
    });
  }

  deleteField(field: MetadataColumn): void {
    if (!field.id || !this.instrumentId) return;

    if (!confirm(`Are you sure you want to delete "${field.name}"?`)) {
      return;
    }

    this.instrumentService.removeMetadataColumn(this.instrumentId, field.id.toString()).subscribe({
      next: () => {
        this.metadataFields.update(fields => fields.filter(f => f.id !== field.id));
        this.toastService.success('Metadata field deleted');
      },
      error: (err) => {
        this.toastService.error('Failed to delete metadata field');
        console.error('Error deleting metadata field:', err);
      }
    });
  }

  close(): void {
    this.activeModal.close(true);
  }
}
