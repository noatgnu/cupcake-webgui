import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ImageViewerModal } from './image-viewer-modal';

describe('ImageViewerModal', () => {
  let component: ImageViewerModal;
  let fixture: ComponentFixture<ImageViewerModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [ImageViewerModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageViewerModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('title defaults to Image Viewer', () => {
    expect(component.title).toBe('Image Viewer');
  });

  it('imageUrl defaults to empty string', () => {
    expect(component.imageUrl).toBe('');
  });

  it('close() calls activeModal.dismiss()', () => {
    component.close();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
