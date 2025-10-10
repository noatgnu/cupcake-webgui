import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';
import { ProtocolService } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { ProtocolCreateModal } from './protocol-create-modal';

describe('ProtocolCreateModal', () => {
  let component: ProtocolCreateModal;
  let fixture: ComponentFixture<ProtocolCreateModal>;
  let mockProtocolService: jasmine.SpyObj<ProtocolService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockProtocolService = jasmine.createSpyObj('ProtocolService', ['createProtocol']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [ProtocolCreateModal, ReactiveFormsModule],
      providers: [
        { provide: ProtocolService, useValue: mockProtocolService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProtocolCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty form', () => {
    expect(component.protocolForm.get('protocolTitle')?.value).toBe('');
    expect(component.protocolForm.get('protocolDescription')?.value).toBe('');
    expect(component.protocolForm.get('enabled')?.value).toBe(false);
  });

  it('should mark form as invalid when title is empty', () => {
    component.protocolForm.patchValue({
      protocolTitle: '',
      protocolDescription: 'Test description'
    });
    expect(component.protocolForm.valid).toBeFalse();
  });

  it('should mark form as valid when title is provided', () => {
    component.protocolForm.patchValue({
      protocolTitle: 'Test Protocol',
      protocolDescription: 'Test description'
    });
    expect(component.protocolForm.valid).toBeTrue();
  });

  it('should show error when creating protocol with invalid form', () => {
    component.protocolForm.patchValue({ protocolTitle: '' });
    component.createProtocol();

    expect(mockToastService.error).toHaveBeenCalledWith('Please fill in required fields');
    expect(mockProtocolService.createProtocol).not.toHaveBeenCalled();
  });

  it('should create protocol and close modal on success', () => {
    const mockProtocol = {
      id: 1,
      protocolTitle: 'Test Protocol',
      protocolDescription: 'Test description',
      enabled: false,
      isVaulted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockProtocolService.createProtocol.and.returnValue(of(mockProtocol));

    component.protocolForm.patchValue({
      protocolTitle: 'Test Protocol',
      protocolDescription: 'Test description',
      enabled: false
    });

    component.createProtocol();

    expect(mockProtocolService.createProtocol).toHaveBeenCalledWith({
      protocolTitle: 'Test Protocol',
      protocolDescription: 'Test description',
      enabled: false
    });
    expect(mockToastService.success).toHaveBeenCalledWith('Protocol created successfully');
    expect(mockActiveModal.close).toHaveBeenCalledWith(mockProtocol);
  });

  it('should show error message on create failure', () => {
    mockProtocolService.createProtocol.and.returnValue(
      throwError(() => new Error('Create failed'))
    );

    component.protocolForm.patchValue({
      protocolTitle: 'Test Protocol',
      protocolDescription: 'Test description'
    });

    component.createProtocol();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to create protocol');
    expect(component.saving).toBeFalse();
    expect(mockActiveModal.close).not.toHaveBeenCalled();
  });

  it('should dismiss modal when cancel is clicked', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should set saving flag during creation', () => {
    const mockProtocol = {
      id: 1,
      protocolTitle: 'Test Protocol',
      enabled: false,
      isVaulted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockProtocolService.createProtocol.and.returnValue(of(mockProtocol));

    component.protocolForm.patchValue({
      protocolTitle: 'Test Protocol'
    });

    expect(component.saving).toBeFalse();
    component.createProtocol();
    expect(component.saving).toBeTrue();
  });
});
