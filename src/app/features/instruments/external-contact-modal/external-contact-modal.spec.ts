import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ContactService, ContactType } from '@noatgnu/cupcake-macaron';
import { ExternalContactModal } from './external-contact-modal';

describe('ExternalContactModal', () => {
  let component: ExternalContactModal;
  let fixture: ComponentFixture<ExternalContactModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockContactService: jasmine.SpyObj<ContactService>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    mockContactService = jasmine.createSpyObj('ContactService', [
      'createExternalContact', 'updateExternalContact',
      'createExternalContactDetail', 'deleteExternalContactDetail'
    ]);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [ExternalContactModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ContactService, useValue: mockContactService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExternalContactModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('initializes with contact data in edit mode', () => {
    const mockContact = {
      id: 1,
      contactName: 'Test Contact',
      contactDetails: [
        { id: 1, contactMethodAltName: 'Work Email', contactType: ContactType.EMAIL, contactValue: 'test@example.com' }
      ]
    } as any;
    component.contact = mockContact;
    component.mode = 'edit';
    component.ngOnInit();
    expect(component.contactName).toBe('Test Contact');
    expect(component.contactDetails().length).toBe(1);
  });

  it('addContactDetail() calls ContactService.createExternalContactDetail()', () => {
    const mockDetail = {
      id: 1, contactMethodAltName: 'Work Email', contactType: ContactType.EMAIL, contactValue: 'test@example.com'
    } as any;
    mockContactService.createExternalContactDetail.and.returnValue(of(mockDetail));
    component.newDetailName = 'Work Email';
    component.newDetailValue = 'test@example.com';
    component.newDetailType = ContactType.EMAIL;
    component.addContactDetail();
    expect(mockContactService.createExternalContactDetail).toHaveBeenCalled();
    expect(component.contactDetails().length).toBe(1);
  });

  it('save() calls ContactService.createExternalContact() in create mode', () => {
    const mockContact = { id: 1, contactName: 'New Contact', contactDetails: [] } as any;
    mockContactService.createExternalContact.and.returnValue(of(mockContact));
    component.contactName = 'New Contact';
    component.mode = 'create';
    component.save();
    expect(mockContactService.createExternalContact).toHaveBeenCalled();
    expect(mockActiveModal.close).toHaveBeenCalledWith(mockContact);
  });

  it('cancel() calls NgbActiveModal.dismiss()', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
