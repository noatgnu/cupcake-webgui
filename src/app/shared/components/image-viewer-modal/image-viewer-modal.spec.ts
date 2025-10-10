import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageViewerModal } from './image-viewer-modal';

describe('ImageViewerModal', () => {
  let component: ImageViewerModal;
  let fixture: ComponentFixture<ImageViewerModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageViewerModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageViewerModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
