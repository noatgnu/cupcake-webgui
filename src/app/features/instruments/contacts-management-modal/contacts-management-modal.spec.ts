import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ContactService, ContactType } from '@noatgnu/cupcake-macaron';
import { ContactsManagementModal } from './contacts-management-modal';

describe('ContactsManagementModal', () => {
  let component: ContactsManagementModal;
  let fixture: ComponentFixture<ContactsManagementModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockContactService: jasmine.SpyObj<ContactService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  const mockResponse = {
    count: 2,
    next: undefined,
    previous: undefined,
    results: [
      {
        id: 1,
        contactName: 'Test Contact 1',
        ownerUsername: 'testuser',
        contactDetails: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 2,
        contactName: 'Test Contact 2',
        ownerUsername: 'testuser2',
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
      }
    ]
  };

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    mockContactService = jasmine.createSpyObj('ContactService', ['getExternalContacts', 'deleteExternalContact']);
    mockContactService.getExternalContacts.and.returnValue(of(mockResponse));
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [ContactsManagementModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ContactService, useValue: mockContactService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsManagementModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load contacts on init', () => {
    expect(mockContactService.getExternalContacts).toHaveBeenCalled();
    expect(component.contacts().length).toBe(2);
  });

  it('should search contacts', () => {
    component.searchQuery = 'test';
    component.searchContacts();
    expect(mockContactService.getExternalContacts).toHaveBeenCalledWith({ search: 'test' });
  });

  it('should delete contact', () => {
    const contact = component.contacts()[0];
    spyOn(window, 'confirm').and.returnValue(true);
    mockContactService.deleteExternalContact.and.returnValue(of(undefined));
    component.deleteContact(contact);
    expect(mockContactService.deleteExternalContact).toHaveBeenCalledWith(1);
    expect(mockToastService.success).toHaveBeenCalled();
  });

  it('should close modal', () => {
    component.close();
    expect(mockActiveModal.close).toHaveBeenCalled();
  });
});
