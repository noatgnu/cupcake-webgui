import { Component, EventEmitter, Input, Output, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-upload',
  imports: [CommonModule],
  templateUrl: './image-upload.html',
  styleUrl: './image-upload.scss'
})
export class ImageUpload {
  @Input() label = 'Image';
  @Input() maxWidth = 800;
  @Input() maxHeight = 800;
  @Input() quality = 0.8;
  @Input() initialImage?: string;

  @Output() imageChange = new EventEmitter<string>();
  @Output() imageCleared = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  imagePreview = signal<string | null>(null);
  isCameraActive = signal(false);
  mediaStream = signal<MediaStream | null>(null);
  error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.initialImage) {
      this.imagePreview.set(this.initialImage);
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
    }
  }

  processFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.error.set('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.onload = () => {
        const resizedBase64 = this.resizeImage(img);
        this.imagePreview.set(resizedBase64);
        this.imageChange.emit(resizedBase64);
        this.error.set(null);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  resizeImage(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    if (width > this.maxWidth || height > this.maxHeight) {
      const ratio = Math.min(this.maxWidth / width, this.maxHeight / height);
      width = width * ratio;
      height = height * ratio;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
    }

    return canvas.toDataURL('image/png');
  }

  async startCamera(): Promise<void> {
    try {
      this.error.set(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.mediaStream.set(stream);
      this.isCameraActive.set(true);

      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }
      }, 0);
    } catch (err) {
      console.error('Error accessing camera:', err);
      this.error.set('Unable to access camera. Please check permissions.');
      this.isCameraActive.set(false);
    }
  }

  captureFromCamera(): void {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const capturedImage = canvas.toDataURL('image/png');

      const img = new Image();
      img.onload = () => {
        const resizedBase64 = this.resizeImage(img);
        this.imagePreview.set(resizedBase64);
        this.imageChange.emit(resizedBase64);
        this.stopCamera();
      };
      img.src = capturedImage;
    }
  }

  stopCamera(): void {
    const stream = this.mediaStream();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      this.mediaStream.set(null);
    }
    this.isCameraActive.set(false);
  }

  clearImage(): void {
    this.imagePreview.set(null);
    this.imageCleared.emit();
    this.error.set(null);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }
}
