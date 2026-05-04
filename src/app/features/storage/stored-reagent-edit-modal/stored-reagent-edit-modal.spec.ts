import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import { StoredReagentEditModal } from './stored-reagent-edit-modal';

describe('StoredReagentEditModal', () => {
  let component: StoredReagentEditModal;
  let fixture: ComponentFixture<StoredReagentEditModal>;

  beforeEach(async () => {
    const mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockReagentService = jasmine.createSpyObj('ReagentService', ['updateStoredReagent']);
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: signal(null)
    });

    await TestBed.configureTestingModule({
      imports: [StoredReagentEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StoredReagentEditModal);
    component = fixture.componentInstance;
    component.storedReagent = {
      id: 1,
      reagent: 1,
      reagentName: 'Test Reagent',
      quantity: 100,
      currentQuantity: 100,
      shareable: false,
      accessAll: false,
      notifyOnLowStock: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('saving signal starts as false', () => {
    expect(component.saving()).toBeFalse();
  });
});
