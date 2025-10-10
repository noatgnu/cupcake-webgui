import { Component, inject, signal, OnInit, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, AnnotationType } from '@noatgnu/cupcake-core';
import { MediaRecorderAnnotation } from '../media-recorder-annotation/media-recorder-annotation';
import { InstrumentBookingAnnotation } from '../instrument-booking-annotation/instrument-booking-annotation';
import { CalculatorAnnotation } from '../calculator-annotation/calculator-annotation';
import { MolarityCalculatorAnnotation } from '../molarity-calculator-annotation/molarity-calculator-annotation';
import type { StepAnnotation } from '@noatgnu/cupcake-red-velvet';
import type { InstrumentUsage } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-annotation-modal',
  imports: [CommonModule, FormsModule, MediaRecorderAnnotation, InstrumentBookingAnnotation, CalculatorAnnotation, MolarityCalculatorAnnotation],
  templateUrl: './annotation-modal.html',
  styleUrl: './annotation-modal.scss'
})
export class AnnotationModal implements OnInit {
  public activeModal = inject(NgbActiveModal);
  private toastService = inject(ToastService);

  @ViewChild(CalculatorAnnotation) calculatorComponent?: CalculatorAnnotation;
  @ViewChild(MolarityCalculatorAnnotation) molarityComponent?: MolarityCalculatorAnnotation;
  @ViewChild(InstrumentBookingAnnotation) bookingComponent?: InstrumentBookingAnnotation;

  stepAnnotation?: StepAnnotation;
  stepId!: number;

  annotationMode: 'text' | 'upload' | 'record' | 'book' | 'calculator' | 'molarity' = 'text';
  selectedFile = signal<File | null>(null);
  selectedAnnotationType = AnnotationType.Image;
  annotationText = '';
  autoTranscribe = true;

  readonly AnnotationType = AnnotationType;

  hasAudio = computed(() => {
    const file = this.selectedFile();
    if (!file) return false;

    const fileType = file.type;
    return fileType.startsWith('audio/') || fileType.startsWith('video/');
  });

  ngOnInit(): void {
    if (this.stepAnnotation) {
      this.selectedAnnotationType = (this.stepAnnotation.annotationType as AnnotationType) || AnnotationType.Image;
      this.annotationText = this.stepAnnotation.annotationText || '';
    }
  }

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
        stepId: this.stepId
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
        stepId: this.stepId
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
        stepId: this.stepId
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
        stepId: this.stepId
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
      stepId: this.stepId
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
