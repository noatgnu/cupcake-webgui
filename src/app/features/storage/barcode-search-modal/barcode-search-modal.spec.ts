import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BarcodeSearchModal } from './barcode-search-modal';

describe('BarcodeSearchModal', () => {
  let component: BarcodeSearchModal;
  let fixture: ComponentFixture<BarcodeSearchModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [BarcodeSearchModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BarcodeSearchModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('scanning signal starts as false', () => {
    expect(component.scanning()).toBeFalse();
  });

  it('error signal starts as null', () => {
    expect(component.error()).toBeNull();
  });

  it('cancel() calls activeModal.dismiss()', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
