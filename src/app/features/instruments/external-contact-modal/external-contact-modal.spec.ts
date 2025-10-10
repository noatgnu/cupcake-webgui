import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';

import { ExternalContactModal } from './external-contact-modal';
import { ContactService, ContactType } from '@noatgnu/cupcake-macaron';
import { ToastService } from '@noatgnu/cupcake-core';

describe('ExternalContactModal', () => {
  let component: ExternalContactModal;
  let fixture: ComponentFixture<ExternalContactModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockContactService: jasmine.SpyObj<ContactService>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    mockContactService = jasmine.createSpyObj('ContactService', [
      'createExternalContact',
      'updateExternalContact',
      'createExternalContactDetail',
      'deleteExternalContactDetail'
    ]);
    mockToastService = jasmine.createSpyObj('ToastService', [
      'success',
      'error'
    ]);

    await TestBed.configureTestingModule({
      imports: [ExternalContactModal, HttpClientTestingModule],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ContactService, useValue: mockContactService },
        { provide: ToastService, useValue: mockToastService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExternalContactModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with contact data in edit mode', () => {
    const mockContact = {
      id: 1,
      contactName: 'Test Contact',
      contactDetails: [
        {
          id: 1,
          contactMethodAltName: 'Work Email',
          contactType: ContactType.EMAIL,
          contactValue: 'test@example.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    component.contact = mockContact;
    component.mode = 'edit';
    component.ngOnInit();

    expect(component.contactName).toBe('Test Contact');
    expect(component.contactDetails().length).toBe(1);
  });

  it('should add contact detail', () => {
    const mockDetail = {
      id: 1,
      contactMethodAltName: 'Work Email',
      contactType: ContactType.EMAIL,
      contactValue: 'test@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockContactService.createExternalContactDetail.and.returnValue(of(mockDetail));

    component.newDetailName = 'Work Email';
    component.newDetailValue = 'test@example.com';
    component.newDetailType = ContactType.EMAIL;

    component.addContactDetail();

    expect(mockContactService.createExternalContactDetail).toHaveBeenCalled();
    expect(component.contactDetails().length).toBe(1);
    expect(mockToastService.success).toHaveBeenCalled();
  });

  it('should create contact', () => {
    const mockContact = {
      id: 1,
      contactName: 'New Contact',
      contactDetails: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockContactService.createExternalContact.and.returnValue(of(mockContact));

    component.contactName = 'New Contact';
    component.mode = 'create';
    component.save();

    expect(mockContactService.createExternalContact).toHaveBeenCalled();
    expect(mockActiveModal.close).toHaveBeenCalledWith(mockContact);
    expect(mockToastService.success).toHaveBeenCalled();
  });

  it('should update contact', () => {
    const mockContact = {
      id: 1,
      contactName: 'Updated Contact',
      contactDetails: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockContactService.updateExternalContact.and.returnValue(of(mockContact));

    component.contact = mockContact;
    component.contactName = 'Updated Contact';
    component.mode = 'edit';
    component.save();

    expect(mockContactService.updateExternalContact).toHaveBeenCalled();
    expect(mockActiveModal.close).toHaveBeenCalledWith(mockContact);
    expect(mockToastService.success).toHaveBeenCalled();
  });

  it('should cancel modal', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
