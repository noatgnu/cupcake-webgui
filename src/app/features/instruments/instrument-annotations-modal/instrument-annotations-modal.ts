import { ChangeDetectionStrategy, Component, inject, Input, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, AnnotationFolder, SiteConfigService, ConfirmDialogService } from '@noatgnu/cupcake-core';
import { InstrumentService, type InstrumentDetail, type InstrumentAnnotation } from '@noatgnu/cupcake-macaron';

interface AnnotationsByFolder {
  folderId: number;
  folderName: string;
  annotations: InstrumentAnnotation[];
}

@Component({
  selector: 'app-instrument-annotations-modal',
  imports: [CommonModule, FormsModule, NgbNavModule],
  templateUrl: './instrument-annotations-modal.html',
  styleUrl: './instrument-annotations-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstrumentAnnotationsModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private confirmDialog = inject(ConfirmDialogService);
  private instrumentService = inject(InstrumentService);
  private toastService = inject(ToastService);
  private siteConfigService = inject(SiteConfigService);

  @Input() instrument!: InstrumentDetail;
  @Input() canManage = false;

  uploading = signal(false);
  uploadProgress = signal(0);
  selectedFile = signal<File | null>(null);
  newAnnotationText = '';
  selectedAnnotationType = 'file';
  loading = signal(true);
  loadingAnnotations = signal(true);
  availableFolders = signal<AnnotationFolder[]>([]);
  instrumentAnnotations = signal<InstrumentAnnotation[]>([]);
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
    return this.instrumentAnnotations().filter(ia => ia.folder === activeFolder.id);
  });

  annotationsByFolder = computed<AnnotationsByFolder[]>(() => {
    const annotations = this.instrumentAnnotations();
    return this.availableFolders().map(folder => ({
      folderId: folder.id,
      folderName: folder.folderName,
      annotations: annotations.filter(ia => ia.folder === folder.id)
    }));
  });

  ngOnInit(): void {
    this.loadFolders();
    this.loadAnnotations();
  }

  loadFolders(): void {
    this.loading.set(true);
    this.instrumentService.getInstrumentFolders(this.instrument.id).subscribe({
      next: (folders) => {
        this.availableFolders.set(folders);
        if (folders.length > 0) {
          this.activeTabId.set(folders[0].id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load folders');
        this.loading.set(false);
      }
    });
  }

  loadAnnotations(): void {
    this.loadingAnnotations.set(true);
    this.instrumentService.getAnnotationsForInstrument(this.instrument.id).subscribe({
      next: (response) => {
        this.instrumentAnnotations.set(response.results);
        this.loadingAnnotations.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load annotations');
        this.loadingAnnotations.set(false);
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

    this.instrumentService.uploadAnnotation(
      this.instrument.id,
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
        this.toastService.success('Document uploaded successfully');
        this.uploading.set(false);
        this.uploadProgress.set(0);
        this.selectedFile.set(null);
        this.newAnnotationText = '';
        this.showUploadForm.set(false);
        this.loadAnnotations();
      },
      error: (err) => {
        this.toastService.error('Failed to upload document');
        this.uploading.set(false);
        this.uploadProgress.set(0);
      }
    });
  }

  async deleteAnnotation(junctionId: number, annotationName: string): Promise<void> {
    if (!(await this.confirmDialog.confirm({ title: 'Delete annotation', message: `Are you sure you want to delete "${annotationName}"?`, confirmLabel: 'Delete' }))) {
      return;
    }

    this.instrumentService.deleteInstrumentAnnotation(junctionId).subscribe({
      next: () => {
        this.toastService.success('Document deleted successfully');
        this.loadAnnotations();
      },
      error: (err) => {
        this.toastService.error('Failed to delete document');
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

}
