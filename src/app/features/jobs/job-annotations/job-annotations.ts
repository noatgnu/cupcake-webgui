import { Component, Input, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import {
  InstrumentJobAnnotationService,
  InstrumentJobAnnotation,
  InstrumentJobAnnotationCreateRequest,
  InstrumentJobAnnotationUpdateRequest,
  AnnotationChunkedUploadService,
  InstrumentUsageService,
  InstrumentUsage,
  InstrumentUsageCreateRequest,
  InstrumentUsageJobAnnotationService,
  CCMNotificationWebSocketService,
  InstrumentService
} from '@noatgnu/cupcake-macaron';
import { ToastService, AuthService, AnnotationType } from '@noatgnu/cupcake-core';
import { MetadataTable, MetadataColumn } from '@noatgnu/cupcake-vanilla';
import { toSignal } from '@angular/core/rxjs-interop';
import { AddAnnotationModal } from './add-annotation-modal/add-annotation-modal';
import { WebvttEditor } from '../../protocols/webvtt-editor/webvtt-editor';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-job-annotations',
  imports: [CommonModule, FormsModule, NgbModule, WebvttEditor],
  templateUrl: './job-annotations.html',
  styleUrl: './job-annotations.scss',
})
export class JobAnnotations implements OnInit, OnDestroy {
  private annotationService = inject(InstrumentJobAnnotationService);
  private chunkedUploadService = inject(AnnotationChunkedUploadService);
  private instrumentUsageService = inject(InstrumentUsageService);
  private usageAnnotationLinkService = inject(InstrumentUsageJobAnnotationService);
  private instrumentService = inject(InstrumentService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);
  private wsService = inject(CCMNotificationWebSocketService);

  private transcriptionSubscription?: Subscription;

  bookingDataCache = signal<Map<number, InstrumentUsage>>(new Map());
  metadataTableCache = signal<Map<number, MetadataTable>>(new Map());
  mediaCurrentTimes = signal<Map<number, number>>(new Map());
  transcribingAnnotations = signal<Set<number>>(new Set());
  loadingBookings = signal<Set<number>>(new Set());
  loadingInstrumentMetadata = signal<Set<number>>(new Set());

  @Input() jobId!: number;
  @Input() canEditStaffOnly = false;
  @Input() isJobOwner = false;

  userAnnotations = signal<InstrumentJobAnnotation[]>([]);
  staffAnnotations = signal<InstrumentJobAnnotation[]>([]);
  loading = signal(false);
  currentUser = toSignal(this.authService.currentUser$);
  activeTab = signal<'user' | 'staff'>('user');
  searchQuery = signal('');
  selectedTypeFilter = signal<string>('all');

  userCurrentPage = signal(1);
  staffCurrentPage = signal(1);
  userTotalCount = signal(0);
  staffTotalCount = signal(0);
  pageSize = 10;

  annotationTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'audio', label: 'Audio' },
    { value: 'file', label: 'File' },
    { value: 'calculator', label: 'Calculator' },
    { value: 'molarity_calculator', label: 'Molarity Calculator' },
    { value: 'booking', label: 'Booking' }
  ];

  userTotalPages = computed(() => {
    return Math.ceil(this.userTotalCount() / this.pageSize);
  });

  staffTotalPages = computed(() => {
    return Math.ceil(this.staffTotalCount() / this.pageSize);
  });

  currentAnnotations = computed(() => {
    return this.activeTab() === 'user' ? this.userAnnotations() : this.staffAnnotations();
  });

  currentTotalPages = computed(() => {
    return this.activeTab() === 'user' ? this.userTotalPages() : this.staffTotalPages();
  });

  currentPage = computed(() => {
    return this.activeTab() === 'user' ? this.userCurrentPage() : this.staffCurrentPage();
  });

  currentTotalCount = computed(() => {
    return this.activeTab() === 'user' ? this.userTotalCount() : this.staffTotalCount();
  });

  canCreateUserAnnotation = computed(() => {
    return this.isJobOwner || this.canEditStaffOnly;
  });

  canCreateStaffAnnotation = computed(() => {
    return this.canEditStaffOnly;
  });

  Math = Math;
  AnnotationType = AnnotationType;

  setActiveTab(tab: 'user' | 'staff'): void {
    this.activeTab.set(tab);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    if (this.activeTab() === 'user') {
      this.userCurrentPage.set(1);
      this.loadUserAnnotations();
    } else {
      this.staffCurrentPage.set(1);
      this.loadStaffAnnotations();
    }
  }

  onTypeFilterChange(type: string): void {
    this.selectedTypeFilter.set(type);
  }

  get filteredAnnotations(): InstrumentJobAnnotation[] {
    const annotations = this.currentAnnotations();
    const typeFilter = this.selectedTypeFilter();

    if (typeFilter === 'all') {
      return annotations;
    }

    return annotations.filter(a => a.annotationType === typeFilter);
  }

  parseCalculatorHistory(jsonString: string): any[] {
    try {
      const data = JSON.parse(jsonString);
      return data.history || [];
    } catch {
      return [];
    }
  }

  parseMolarityData(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  formatCalculatorExpression(entry: any): string {
    return `${entry.expression} = ${entry.result}`;
  }

  formatMolarityCalculatorExpression(entry: any): string {
    if (entry.mass !== undefined) {
      return `Mass: ${entry.mass}g, MW: ${entry.molecularWeight}g/mol, Volume: ${entry.volume}L = ${entry.molarity}M`;
    }
    return `${entry.expression || ''} = ${entry.result || entry.molarity}M`;
  }

  ngOnInit(): void {
    if (this.jobId) {
      this.loadAnnotations();
    }

    this.wsService.transcriptionStarted$.subscribe(event => {
      this.handleTranscriptionStarted(event.annotation_id);
    });

    this.transcriptionSubscription = this.wsService.transcriptionCompleted$.subscribe(event => {
      this.handleTranscriptionCompleted(event.annotation_id);
    });
  }

  ngOnDestroy(): void {
    if (this.transcriptionSubscription) {
      this.transcriptionSubscription.unsubscribe();
    }
  }

  private handleTranscriptionStarted(annotationId: number): void {
    const userAnnotation = this.userAnnotations().find(a => a.annotation === annotationId);
    const staffAnnotation = this.staffAnnotations().find(a => a.annotation === annotationId);

    if (userAnnotation || staffAnnotation) {
      const transcribing = this.transcribingAnnotations();
      transcribing.add(annotationId);
      this.transcribingAnnotations.set(new Set(transcribing));
      this.toastService.info('Transcription started');
    }
  }

  private handleTranscriptionCompleted(annotationId: number): void {
    const userAnnotation = this.userAnnotations().find(a => a.annotation === annotationId);
    const staffAnnotation = this.staffAnnotations().find(a => a.annotation === annotationId);

    if (userAnnotation || staffAnnotation) {
      const transcribing = this.transcribingAnnotations();
      transcribing.delete(annotationId);
      this.transcribingAnnotations.set(new Set(transcribing));
      this.toastService.success('Transcription completed');
      this.loadAnnotations();
    }
  }

  loadAnnotations(): void {
    this.loading.set(true);
    this.loadUserAnnotations();
    this.loadStaffAnnotations();
  }

  loadUserAnnotations(): void {
    const page = this.userCurrentPage();
    const offset = (page - 1) * this.pageSize;
    const search = this.searchQuery();

    this.annotationService.getUserAnnotationsForJob(this.jobId, {
      limit: this.pageSize,
      offset: offset,
      ordering: 'order,created_at',
      search: search || undefined
    }).subscribe({
      next: (response) => {
        this.userAnnotations.set(response.results);
        this.userTotalCount.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading user annotations:', err);
        this.toastService.error('Failed to load user annotations');
        this.loading.set(false);
      }
    });
  }

  loadStaffAnnotations(): void {
    const page = this.staffCurrentPage();
    const offset = (page - 1) * this.pageSize;
    const search = this.searchQuery();

    this.annotationService.getStaffAnnotationsForJob(this.jobId, {
      limit: this.pageSize,
      offset: offset,
      ordering: 'order,created_at',
      search: search || undefined
    }).subscribe({
      next: (response) => {
        this.staffAnnotations.set(response.results);
        this.staffTotalCount.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading staff annotations:', err);
        this.toastService.error('Failed to load staff annotations');
        this.loading.set(false);
      }
    });
  }

  isStaffAnnotation(annotation: InstrumentJobAnnotation): boolean {
    return annotation.role === 'staff';
  }

  addAnnotation(isStaffAnnotation: boolean = false): void {
    const user = this.currentUser();
    if (!user) {
      this.toastService.error('You must be logged in to add annotations');
      return;
    }

    if (isStaffAnnotation && !this.canCreateStaffAnnotation()) {
      this.toastService.error('Only users with staff-only permission can add staff annotations');
      return;
    }

    if (!isStaffAnnotation && !this.canCreateUserAnnotation()) {
      this.toastService.error('You do not have permission to add annotations');
      return;
    }

    this.openAddAnnotationModal(isStaffAnnotation);
  }

  openAddAnnotationModal(isStaffAnnotation: boolean): void {
    const modalRef = this.modalService.open(AddAnnotationModal, { size: 'lg', backdrop: 'static' });
    modalRef.componentInstance.isStaffAnnotation = isStaffAnnotation;
    modalRef.componentInstance.jobId = this.jobId;

    modalRef.result.then(
      (result: any) => {
        if (result) {
          this.handleModalResult(result);
        }
      },
      () => {}
    );
  }

  private handleModalResult(result: any): void {
    const isStaffAnnotation = result.isStaffAnnotation || false;

    if (result.text && result.annotationType === AnnotationType.Text) {
      this.createTextAnnotation(result.text, isStaffAnnotation);
    } else if (result.file) {
      this.uploadFileAnnotation(
        result.file,
        result.annotationType,
        result.annotationText,
        result.autoTranscribe,
        isStaffAnnotation
      );
    } else if (result.bookingData) {
      this.createBookingAnnotation(result.bookingData);
    } else if (result.calculatorData) {
      this.createCalculatorAnnotation(result.calculatorData, isStaffAnnotation);
    } else if (result.molarityData) {
      this.createMolarityAnnotation(result.molarityData, isStaffAnnotation);
    }
  }

  private createTextAnnotation(text: string, isStaffAnnotation: boolean = false): void {
    const request: InstrumentJobAnnotationCreateRequest = {
      instrumentJob: this.jobId,
      annotationData: {
        annotation: text,
        annotationType: AnnotationType.Text
      },
      role: isStaffAnnotation ? 'staff' : 'user',
      order: isStaffAnnotation ? this.staffAnnotations().length : this.userAnnotations().length
    };

    this.annotationService.createInstrumentJobAnnotation(request).subscribe({
      next: (annotation) => {
        this.toastService.success('Text annotation added successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        console.error('Error creating text annotation:', err);
        this.toastService.error('Failed to add text annotation');
      }
    });
  }

  private uploadFileAnnotation(
    file: File,
    annotationType: string,
    annotationText: string,
    autoTranscribe: boolean,
    isStaffAnnotation: boolean = false
  ): void {
    this.toastService.info('Uploading file...');

    this.chunkedUploadService.uploadInstrumentJobAnnotationFileInChunks(
      file,
      this.jobId,
      undefined,
      1024 * 1024,
      {
        annotation: annotationText,
        annotationType: annotationType,
        autoTranscribe: autoTranscribe,
        role: isStaffAnnotation ? 'staff' : 'user'
      }
    ).subscribe({
      next: () => {
        this.toastService.success('File uploaded successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        console.error('Error uploading file:', err);
        this.toastService.error('Failed to upload file');
      }
    });
  }

  private createBookingAnnotation(bookingData: InstrumentUsageCreateRequest): void {
    this.loading.set(true);

    this.instrumentUsageService.createInstrumentUsage(bookingData).subscribe({
      next: (usage) => {
        const request: InstrumentJobAnnotationCreateRequest = {
          instrumentJob: this.jobId,
          annotationData: {
            annotation: `Instrument booking for ${usage.instrumentName || 'instrument'}`,
            annotationType: AnnotationType.Booking
          },
          role: 'staff',
          order: this.staffAnnotations().length
        };

        this.annotationService.createInstrumentJobAnnotation(request).subscribe({
          next: (annotation) => {
            this.usageAnnotationLinkService.linkJobAnnotationToBooking(annotation.id!, usage.id).subscribe({
              next: () => {
                this.bookingDataCache.update(cache => {
                  const newCache = new Map(cache);
                  newCache.set(annotation.id!, usage);
                  return newCache;
                });
                this.toastService.success('Instrument booked and linked to job');
                this.loading.set(false);
                this.loadAnnotations();
              },
              error: (err) => {
                console.error('Error linking booking to annotation:', err);
                this.toastService.error('Failed to link booking to annotation');
                this.loading.set(false);
              }
            });
          },
          error: (err) => {
            console.error('Error creating job annotation for booking:', err);
            this.toastService.error('Failed to create job annotation for booking');
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error creating instrument booking:', err);
        this.toastService.error('Failed to create instrument booking');
        this.loading.set(false);
      }
    });
  }

  private createCalculatorAnnotation(calculatorData: any, isStaffAnnotation: boolean = false): void {
    const request: InstrumentJobAnnotationCreateRequest = {
      instrumentJob: this.jobId,
      annotationData: {
        annotation: JSON.stringify(calculatorData),
        annotationType: AnnotationType.Calculator
      },
      role: isStaffAnnotation ? 'staff' : 'user',
      order: isStaffAnnotation ? this.staffAnnotations().length : this.userAnnotations().length
    };

    this.annotationService.createInstrumentJobAnnotation(request).subscribe({
      next: (annotation) => {
        this.toastService.success('Calculator annotation added successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        console.error('Error creating calculator annotation:', err);
        this.toastService.error('Failed to add calculator annotation');
      }
    });
  }

  private createMolarityAnnotation(molarityData: any, isStaffAnnotation: boolean = false): void {
    const request: InstrumentJobAnnotationCreateRequest = {
      instrumentJob: this.jobId,
      annotationData: {
        annotation: JSON.stringify(molarityData),
        annotationType: AnnotationType.MolarityCalculator
      },
      role: isStaffAnnotation ? 'staff' : 'user',
      order: isStaffAnnotation ? this.staffAnnotations().length : this.userAnnotations().length
    };

    this.annotationService.createInstrumentJobAnnotation(request).subscribe({
      next: (annotation) => {
        this.toastService.success('Molarity calculator annotation added successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        console.error('Error creating molarity annotation:', err);
        this.toastService.error('Failed to add molarity annotation');
      }
    });
  }

  editAnnotation(annotation: InstrumentJobAnnotation): void {
    if (!annotation.canEdit) {
      this.toastService.error('You do not have permission to edit this annotation');
      return;
    }

    const newText = prompt('Edit annotation:', annotation.annotationText || '');
    if (newText === null || newText.trim() === '') {
      return;
    }

    const request: InstrumentJobAnnotationUpdateRequest = {
      annotationText: newText.trim()
    };

    this.annotationService.updateInstrumentJobAnnotation(annotation.id, request).subscribe({
      next: (updated) => {
        this.toastService.success('Annotation updated successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        console.error('Error updating annotation:', err);
        this.toastService.error('Failed to update annotation');
      }
    });
  }

  deleteAnnotation(annotation: InstrumentJobAnnotation): void {
    if (!annotation.canDelete) {
      this.toastService.error('You do not have permission to delete this annotation');
      return;
    }

    if (!confirm('Are you sure you want to delete this annotation?')) {
      return;
    }

    this.annotationService.deleteInstrumentJobAnnotation(annotation.id).subscribe({
      next: () => {
        this.toastService.success('Annotation deleted successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        console.error('Error deleting annotation:', err);
        this.toastService.error('Failed to delete annotation');
      }
    });
  }

  getAnnotationTypeIcon(annotation: InstrumentJobAnnotation): string {
    switch (annotation.annotationType) {
      case 'text':
        return 'bi-chat-text';
      case 'booking':
        return 'bi-calendar-check';
      case 'file':
        return 'bi-file-earmark';
      case 'image':
        return 'bi-image';
      case 'video':
        return 'bi-camera-video';
      case 'audio':
        return 'bi-mic';
      default:
        return 'bi-chat-dots';
    }
  }

  getAnnotationTypeBadge(annotation: InstrumentJobAnnotation): string {
    return annotation.annotationType || 'text';
  }

  onPageChange(page: number): void {
    if (this.activeTab() === 'user') {
      this.userCurrentPage.set(page);
      this.loadUserAnnotations();
    } else {
      this.staffCurrentPage.set(page);
      this.loadStaffAnnotations();
    }
  }

  retriggerTranscription(annotation: InstrumentJobAnnotation): void {
    if (!annotation.id) {
      this.toastService.error('Invalid annotation');
      return;
    }

    if (annotation.annotationType !== 'audio' && annotation.annotationType !== 'video') {
      this.toastService.error('Only audio and video annotations can be retranscribed');
      return;
    }

    const user = this.currentUser();
    if (!user?.isStaff && !user?.isSuperuser) {
      this.toastService.error('Only staff and admin users can retrigger transcription');
      return;
    }

    if (confirm('Are you sure you want to retrigger transcription for this annotation? This will clear existing transcription data and queue a new task.')) {
      this.annotationService.retriggerTranscription(annotation.id).subscribe({
        next: (response) => {
          this.toastService.success(response.message || 'Transcription task queued successfully');
          this.loadAnnotations();
        },
        error: (err) => {
          console.error('Error retriggering transcription:', err);
          this.toastService.error(err.error?.error || 'Failed to retrigger transcription');
        }
      });
    }
  }

  canRetriggerTranscription(annotation: InstrumentJobAnnotation): boolean {
    const user = this.currentUser();
    if (!user?.isStaff && !user?.isSuperuser) {
      return false;
    }
    return annotation.annotationType === 'audio' || annotation.annotationType === 'video';
  }

  isTranscribing(annotation: InstrumentJobAnnotation): boolean {
    return this.transcribingAnnotations().has(annotation.annotation);
  }

  getBookingData(annotation: InstrumentJobAnnotation): InstrumentUsage | null {
    if (!annotation.id) return null;

    const cachedBooking = this.bookingDataCache().get(annotation.id);
    if (cachedBooking) {
      return cachedBooking;
    }

    if (!this.loadingBookings().has(annotation.id)) {
      setTimeout(() => this.loadBookingDataForAnnotation(annotation.id), 0);
    }
    return null;
  }

  private loadBookingDataForAnnotation(annotationId: number): void {
    this.loadingBookings.update(loading => {
      const newSet = new Set(loading);
      newSet.add(annotationId);
      return newSet;
    });

    this.usageAnnotationLinkService.getByInstrumentJobAnnotation(annotationId).subscribe({
      next: (response) => {
        if (response.results && response.results.length > 0) {
          const link = response.results[0];
          this.instrumentUsageService.getInstrumentUsageRecord(link.instrumentUsage).subscribe({
            next: (usage) => {
              this.bookingDataCache.update(cache => {
                const newCache = new Map(cache);
                newCache.set(annotationId, usage);
                return newCache;
              });

              this.loadingBookings.update(loading => {
                const newSet = new Set(loading);
                newSet.delete(annotationId);
                return newSet;
              });

              if (usage.instrument) {
                this.loadInstrumentData(usage.instrument);
              }
            },
            error: (err) => {
              console.error(`Error loading booking data for usage ${link.instrumentUsage}:`, err);
              this.loadingBookings.update(loading => {
                const newSet = new Set(loading);
                newSet.delete(annotationId);
                return newSet;
              });
            }
          });
        } else {
          this.loadingBookings.update(loading => {
            const newSet = new Set(loading);
            newSet.delete(annotationId);
            return newSet;
          });
        }
      },
      error: (err) => {
        console.error(`Error loading booking link for annotation ${annotationId}:`, err);
        this.loadingBookings.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(annotationId);
          return newSet;
        });
      }
    });
  }

  private loadInstrumentData(instrumentId: number): void {
    if (this.metadataTableCache().has(instrumentId) || this.loadingInstrumentMetadata().has(instrumentId)) {
      return;
    }

    this.loadingInstrumentMetadata.update(loading => {
      const newSet = new Set(loading);
      newSet.add(instrumentId);
      return newSet;
    });

    this.instrumentService.getInstrumentMetadata(instrumentId).subscribe({
      next: (metadataTable) => {
        this.metadataTableCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(instrumentId, metadataTable);
          return newCache;
        });

        this.loadingInstrumentMetadata.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(instrumentId);
          return newSet;
        });
      },
      error: (err) => {
        console.error(`Error loading instrument metadata ${instrumentId}:`, err);
        this.loadingInstrumentMetadata.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(instrumentId);
          return newSet;
        });
      }
    });
  }

  getMetadataForInstrument(instrumentId: number): MetadataTable | null {
    return this.metadataTableCache().get(instrumentId) || null;
  }

  onMediaTimeUpdate(annotationId: number, event: Event): void {
    const media = event.target as HTMLMediaElement;
    const times = this.mediaCurrentTimes();
    times.set(annotationId, media.currentTime);
    this.mediaCurrentTimes.set(new Map(times));
  }

  getMediaCurrentTime(annotationId: number): number {
    return this.mediaCurrentTimes().get(annotationId) || 0;
  }

  onTranscriptionChanged(annotationId: number, transcription: string): void {
    this.annotationService.updateInstrumentJobAnnotation(annotationId, {
      annotationData: { transcription }
    }).subscribe({
      next: (updatedAnnotation) => {
        this.toastService.success('Transcription updated successfully');
        const userAnnotations = this.userAnnotations();
        const staffAnnotations = this.staffAnnotations();

        const userIndex = userAnnotations.findIndex(a => a.id === annotationId);
        if (userIndex !== -1) {
          const updated = [...userAnnotations];
          updated[userIndex] = updatedAnnotation;
          this.userAnnotations.set(updated);
        }

        const staffIndex = staffAnnotations.findIndex(a => a.id === annotationId);
        if (staffIndex !== -1) {
          const updated = [...staffAnnotations];
          updated[staffIndex] = updatedAnnotation;
          this.staffAnnotations.set(updated);
        }
      },
      error: (err) => {
        console.error('Error updating transcription:', err);
        this.toastService.error(err.error?.error || 'Failed to update transcription');
      }
    });
  }

  downloadAnnotation(annotation: InstrumentJobAnnotation): void {
    if (!annotation.id) {
      this.toastService.error('Invalid annotation');
      return;
    }

    this.annotationService.getInstrumentJobAnnotation(annotation.id).subscribe({
      next: (freshAnnotation) => {
        if (freshAnnotation.fileUrl) {
          const link = document.createElement('a');
          link.href = freshAnnotation.fileUrl;
          link.download = freshAnnotation.annotationName || 'file';
          link.click();
        } else {
          this.toastService.error('No file URL available');
        }
      },
      error: (err) => {
        console.error('Error fetching fresh download URL:', err);
        this.toastService.error('Failed to download file');
      }
    });
  }
}
