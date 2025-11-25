import { Component, inject, Input, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, ApiService, Annotation, AnnotationType, SiteConfigService } from '@noatgnu/cupcake-core';
import { MaintenanceService, type MaintenanceLog, type MaintenanceLogAnnotation } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-maintenance-log-annotations-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './maintenance-log-annotations-modal.html',
  styleUrl: './maintenance-log-annotations-modal.scss'
})
export class MaintenanceLogAnnotationsModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private maintenanceService = inject(MaintenanceService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private siteConfigService = inject(SiteConfigService);

  @Input() maintenanceLog!: MaintenanceLog;
  @Input() canManage = false;

  uploading = signal(false);
  uploadProgress = signal(0);
  selectedFile = signal<File | null>(null);
  newAnnotationText = '';
  selectedAnnotationType = 'file';
  loading = signal(true);
  loadingAnnotations = signal(true);
  maintenanceLogAnnotations = signal<MaintenanceLogAnnotation[]>([]);
  showUploadForm = signal(false);

  maxUploadSizeText = computed(() => {
    const maxSize = this.siteConfigService.getMaxChunkedUploadSize();
    return this.siteConfigService.formatFileSize(maxSize);
  });

  ngOnInit(): void {
    this.loadAnnotations();
  }

  loadAnnotations(): void {
    this.loadingAnnotations.set(true);
    this.maintenanceService.getAnnotationsForMaintenanceLog(this.maintenanceLog.id).subscribe({
      next: (response) => {
        this.maintenanceLogAnnotations.set(response.results);
        this.loadingAnnotations.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load annotations');
        console.error('Error loading maintenance log annotations:', err);
        this.loadingAnnotations.set(false);
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile.set(input.files[0]);
    }
  }

  uploadAnnotation(): void {
    const file = this.selectedFile();
    if (!file && this.selectedAnnotationType === 'file') {
      this.toastService.error('Please select a file');
      return;
    }

    if (this.selectedAnnotationType === 'text' && !this.newAnnotationText.trim()) {
      this.toastService.error('Please enter annotation text');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(0);

    const existingAnnotations = this.maintenanceLogAnnotations();
    const maxOrder = existingAnnotations.length > 0
      ? Math.max(...existingAnnotations.map(a => a.order))
      : 0;

    if (this.selectedAnnotationType === 'text') {
      this.maintenanceService.createMaintenanceLogAnnotation({
        maintenanceLog: this.maintenanceLog.id,
        annotationData: {
          annotation: this.newAnnotationText,
          annotationType: AnnotationType.Text
        },
        order: maxOrder + 1
      }).subscribe({
        next: () => {
          this.toastService.success('Annotation added successfully');
          this.uploading.set(false);
          this.uploadProgress.set(0);
          this.selectedFile.set(null);
          this.newAnnotationText = '';
          this.showUploadForm.set(false);
          this.loadAnnotations();
        },
        error: (err) => {
          this.toastService.error('Failed to create annotation');
          console.error('Error creating annotation:', err);
          this.uploading.set(false);
          this.uploadProgress.set(0);
        }
      });
    } else if (this.selectedAnnotationType === 'file' && file) {
      this.toastService.error('File uploads for maintenance log annotations need to be implemented using chunked upload service');
      this.uploading.set(false);
    }
  }

  deleteAnnotation(maintenanceLogAnnotation: MaintenanceLogAnnotation): void {
    if (!this.canManage) {
      this.toastService.error('You do not have permission to delete annotations');
      return;
    }

    if (!confirm('Are you sure you want to delete this annotation?')) {
      return;
    }

    this.maintenanceService.deleteMaintenanceLogAnnotation(maintenanceLogAnnotation.id).subscribe({
      next: () => {
        this.toastService.success('Annotation deleted successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        this.toastService.error('Failed to delete annotation');
        console.error('Error deleting annotation:', err);
      }
    });
  }

  downloadAnnotation(maintenanceLogAnnotation: MaintenanceLogAnnotation): void {
    if (!maintenanceLogAnnotation.fileUrl) return;
    window.open(maintenanceLogAnnotation.fileUrl, '_blank');
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
