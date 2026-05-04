import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StorageEditModal } from './storage-edit-modal';

describe('StorageEditModal', () => {
  let component: StorageEditModal;
  let fixture: ComponentFixture<StorageEditModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [StorageEditModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('close() calls activeModal.dismiss()', () => {
    component.close();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
