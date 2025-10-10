import { Component, inject, signal, computed, ViewChild, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, AnnotationType } from '@noatgnu/cupcake-core';
import { MediaRecorderAnnotation } from '../../../protocols/media-recorder-annotation/media-recorder-annotation';
import { InstrumentBookingAnnotation } from '../../../protocols/instrument-booking-annotation/instrument-booking-annotation';
import { CalculatorAnnotation } from '../../../protocols/calculator-annotation/calculator-annotation';
import { MolarityCalculatorAnnotation } from '../../../protocols/molarity-calculator-annotation/molarity-calculator-annotation';

@Component({
  selector: 'app-add-annotation-modal',
  imports: [CommonModule, FormsModule, MediaRecorderAnnotation, InstrumentBookingAnnotation, CalculatorAnnotation, MolarityCalculatorAnnotation],
  templateUrl: './add-annotation-modal.html',
  styleUrl: './add-annotation-modal.scss',
})
export class AddAnnotationModal {
  public activeModal = inject(NgbActiveModal);
  private toastService = inject(ToastService);

  @ViewChild(CalculatorAnnotation) calculatorComponent?: CalculatorAnnotation;
  @ViewChild(MolarityCalculatorAnnotation) molarityComponent?: MolarityCalculatorAnnotation;
  @ViewChild(InstrumentBookingAnnotation) bookingComponent?: InstrumentBookingAnnotation;

  @Input() isStaffAnnotation = false;
  @Input() jobId!: number;

  annotationMode: 'text' | 'upload' | 'record' | 'book' | 'calculator' | 'molarity' = 'text';
  selectedFile = signal<File | null>(null);
  selectedAnnotationType = AnnotationType.Image;
  annotationText = '';
  autoTranscribe = true;

  readonly AnnotationType = AnnotationType;

  get modalTitle(): string {
    return this.isStaffAnnotation ? 'Add Staff Annotation' : 'Add User Annotation';
  }

  get availableModes() {
    if (this.isStaffAnnotation) {
      return ['text', 'upload', 'record', 'book', 'calculator', 'molarity'];
    }
    return ['text', 'upload', 'record', 'calculator', 'molarity'];
  }

  hasAudio = computed(() => {
    const file = this.selectedFile();
    if (!file) return false;

    const fileType = file.type;
    return fileType.startsWith('audio/') || fileType.startsWith('video/');
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFile.set(file);
      this.detectFileType(file);
    }
  }

  onRecordingComplete(file: File | null): void {
    this.selectedFile.set(file);
    if (file) {
      this.detectFileType(file);
    }
  }

  private detectFileType(file: File): void {
    const mimeType = file.type;

    if (mimeType.startsWith('image/')) {
      this.selectedAnnotationType = AnnotationType.Image;
    } else if (mimeType.startsWith('video/')) {
      this.selectedAnnotationType = AnnotationType.Video;
    } else if (mimeType.startsWith('audio/')) {
      this.selectedAnnotationType = AnnotationType.Audio;
    } else {
      this.selectedAnnotationType = AnnotationType.File;
    }
  }

  onRecordingCancelled(): void {
    this.annotationMode = 'upload';
  }

  onBookingCancelled(): void {
    this.annotationMode = 'upload';
  }

  clearFile(): void {
    this.selectedFile.set(null);
  }

  save(): void {
    if (this.annotationMode === 'text') {
      if (!this.annotationText.trim()) {
        this.toastService.error('Please enter annotation text');
        return;
      }

      this.activeModal.close({
        text: this.annotationText,
        annotationType: AnnotationType.Text,
        jobId: this.jobId
      });
      return;
    }

    if (this.annotationMode === 'book') {
      if (!this.bookingComponent || !this.bookingComponent.isValid()) {
        this.toastService.error('Please fill in all required booking information');
        return;
      }

      const bookingData = this.bookingComponent.getBookingData();
      if (!bookingData) {
        this.toastService.error('Invalid booking data');
        return;
      }

      this.activeModal.close({
        bookingData: bookingData,
        annotationType: AnnotationType.Booking,
        jobId: this.jobId
      });
      return;
    }

    if (this.annotationMode === 'calculator') {
      if (!this.calculatorComponent || this.calculatorComponent.dataLog().length === 0) {
        this.toastService.error('Please perform at least one calculation');
        return;
      }

      this.activeModal.close({
        calculatorData: {
          history: this.calculatorComponent.dataLog()
        },
        annotationType: AnnotationType.Calculator,
        jobId: this.jobId
      });
      return;
    }

    if (this.annotationMode === 'molarity') {
      if (!this.molarityComponent || this.molarityComponent.dataLog().length === 0) {
        this.toastService.error('Please perform at least one calculation');
        return;
      }

      this.activeModal.close({
        molarityData: {
          history: this.molarityComponent.dataLog()
        },
        annotationType: AnnotationType.MolarityCalculator,
        jobId: this.jobId
      });
      return;
    }

    if (!this.selectedFile()) {
      this.toastService.error('Please select a file or record media');
      return;
    }

    this.activeModal.close({
      file: this.selectedFile(),
      annotationType: this.selectedAnnotationType,
      annotationText: this.annotationText,
      autoTranscribe: this.autoTranscribe,
      jobId: this.jobId
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
