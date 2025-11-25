import { Component, inject, Input, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, ApiService, AnnotationFolder, Annotation, SiteConfigService } from '@noatgnu/cupcake-core';
import { ReagentService, StoredReagent, StoredReagentAnnotation } from '@noatgnu/cupcake-macaron';

interface AnnotationsByFolder {
  folderId: number;
  folderName: string;
  annotations: Array<{
    junctionId: number;
    annotation: Annotation;
    storedReagentAnnotation: StoredReagentAnnotation;
  }>;
}

@Component({
  selector: 'app-stored-reagent-annotations-modal',
  imports: [CommonModule, FormsModule, NgbNavModule],
  templateUrl: './stored-reagent-annotations-modal.html',
  styleUrl: './stored-reagent-annotations-modal.scss'
})
export class StoredReagentAnnotationsModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private reagentService = inject(ReagentService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private siteConfigService = inject(SiteConfigService);

  @Input() storedReagent!: StoredReagent;
  @Input() canManage = false;

  uploading = signal(false);
  uploadProgress = signal(0);
  selectedFile = signal<File | null>(null);
  newAnnotationText = '';
  selectedAnnotationType = 'file';
  loading = signal(true);
  loadingAnnotations = signal(true);
  availableFolders = signal<AnnotationFolder[]>([]);
  storedReagentAnnotations = signal<StoredReagentAnnotation[]>([]);
  annotationDetails = signal<Map<number, Annotation>>(new Map());
  showUploadForm = signal(false);
  activeTabId = signal<number | null>(null);

  activeFolder = computed(() => {
    const folders = this.availableFolders();
    const activeId = this.activeTabId();
    return folders.find(f => f.id === activeId) || folders[0] || null;
  });

  maxUploadSizeText = computed(() => {
    const maxSize = this.siteConfigService.getMaxChunkedUploadSize();
    return this.siteConfigService.formatFileSize(maxSize);
  });

  currentTabAnnotations = computed(() => {
    const activeFolder = this.activeFolder();
    if (!activeFolder) return [];

    const annotations = this.storedReagentAnnotations();
    const details = this.annotationDetails();

    const items: Array<{
      junctionId: number;
      annotation: Annotation;
      storedReagentAnnotation: StoredReagentAnnotation;
    }> = [];

    annotations.forEach(sra => {
      if (sra.folder === activeFolder.id) {
        const annotation = details.get(sra.annotation);
        if (annotation) {
          items.push({
            junctionId: sra.id,
            annotation: annotation,
            storedReagentAnnotation: sra
          });
        }
      }
    });

    return items;
  });

  annotationsByFolder = computed(() => {
    const folders = this.availableFolders();
    const annotations = this.storedReagentAnnotations();
    const details = this.annotationDetails();

    const grouped: AnnotationsByFolder[] = folders.map(folder => ({
      folderId: folder.id,
      folderName: folder.folderName,
      annotations: []
    }));

    annotations.forEach(sra => {
      const folderGroup = grouped.find(g => g.folderId === sra.folder);
      const annotation = details.get(sra.annotation);
      if (folderGroup && annotation) {
        folderGroup.annotations.push({
          junctionId: sra.id,
          annotation: annotation,
          storedReagentAnnotation: sra
        });
      }
    });

    return grouped;
  });

  ngOnInit(): void {
    this.loadFolders();
    this.loadAnnotations();
  }

  loadFolders(): void {
    this.loading.set(true);
    this.reagentService.getStoredReagentFolders(this.storedReagent.id).subscribe({
      next: (folders) => {
        this.availableFolders.set(folders);
        if (folders.length > 0) {
          this.activeTabId.set(folders[0].id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load folders');
        console.error('Error loading folders:', err);
        this.loading.set(false);
      }
    });
  }

  loadAnnotations(): void {
    this.loadingAnnotations.set(true);
    this.reagentService.getAnnotationsForStoredReagent(this.storedReagent.id).subscribe({
      next: (response) => {
        this.storedReagentAnnotations.set(response.results);
        response.results.forEach(sra => {
          this.loadAnnotationDetails(sra.annotation);
        });
        this.loadingAnnotations.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load annotations');
        console.error('Error loading annotations:', err);
        this.loadingAnnotations.set(false);
      }
    });
  }

  loadAnnotationDetails(annotationId: number): void {
    this.apiService.getAnnotation(annotationId).subscribe({
      next: (annotation) => {
        const details = new Map(this.annotationDetails());
        details.set(annotationId, annotation);
        this.annotationDetails.set(details);
      },
      error: (err) => {
        console.error('Error loading annotation details:', err);
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile.set(input.files[0]);
      this.detectAnnotationType(input.files[0]);
    }
  }

  detectAnnotationType(file: File): void {
    const fileName = file.name.toLowerCase();
    const ext = fileName.split('.').pop() || '';

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];

    if (imageExts.includes(ext)) {
      this.selectedAnnotationType = 'image';
    } else if (videoExts.includes(ext)) {
      this.selectedAnnotationType = 'video';
    } else if (audioExts.includes(ext)) {
      this.selectedAnnotationType = 'audio';
    } else {
      this.selectedAnnotationType = 'file';
    }
  }

  uploadAnnotation(): void {
    const file = this.selectedFile();
    const activeFolder = this.activeFolder();

    if (!file) {
      this.toastService.error('Please select a file to upload');
      return;
    }

    if (!activeFolder) {
      this.toastService.error('No folder selected');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(0);

    this.reagentService.uploadAnnotation(
      this.storedReagent.id,
      activeFolder.id,
      file,
      {
        annotation: this.newAnnotationText || `Uploaded file: ${file.name}`,
        annotationType: this.selectedAnnotationType,
        onProgress: (progress) => {
          this.uploadProgress.set(Math.round(progress));
        }
      }
    ).subscribe({
      next: () => {
        this.toastService.success('Annotation uploaded successfully');
        this.uploading.set(false);
        this.uploadProgress.set(0);
        this.selectedFile.set(null);
        this.newAnnotationText = '';
        this.showUploadForm.set(false);
        this.loadAnnotations();
      },
      error: (err) => {
        this.toastService.error('Failed to upload annotation');
        console.error('Error uploading annotation:', err);
        this.uploading.set(false);
        this.uploadProgress.set(0);
      }
    });
  }

  deleteAnnotation(junctionId: number, annotationName: string): void {
    if (!confirm(`Are you sure you want to delete "${annotationName}"?`)) {
      return;
    }

    this.reagentService.deleteStoredReagentAnnotation(junctionId).subscribe({
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

  cancelUpload(): void {
    this.showUploadForm.set(false);
    this.selectedFile.set(null);
    this.newAnnotationText = '';
    this.uploadProgress.set(0);
    this.selectedAnnotationType = 'file';
  }

  cancel(): void {
    this.activeModal.dismiss();
  }

  getAnnotationTypeIcon(type: string | undefined): string {
    if (!type) return 'bi-paperclip';

    const icons: Record<string, string> = {
      'image': 'bi-image',
      'video': 'bi-camera-video',
      'audio': 'bi-mic',
      'document': 'bi-file-earmark-text',
      'text': 'bi-sticky',
      'file': 'bi-paperclip'
    };
    return icons[type.toLowerCase()] || 'bi-paperclip';
  }

  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }
}
