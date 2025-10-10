import { Component, Input, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-viewer-modal',
  imports: [CommonModule],
  templateUrl: './image-viewer-modal.html',
  styleUrl: './image-viewer-modal.scss'
})
export class ImageViewerModal {
  private activeModal = inject(NgbActiveModal);

  @Input() imageUrl = '';
  @Input() title = 'Image Viewer';

  close(): void {
    this.activeModal.dismiss();
  }
}
