import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, LabGroupService } from '@noatgnu/cupcake-core';
import { StorageService } from '@noatgnu/cupcake-macaron';
import { StorageAccessModal } from './storage-access-modal';

describe('StorageAccessModal', () => {
  let component: StorageAccessModal;
  let fixture: ComponentFixture<StorageAccessModal>;

  beforeEach(async () => {
    const mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockStorageService = jasmine.createSpyObj('StorageService', ['updateStorageObject']);
    const mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['getLabGroups']);
    mockLabGroupService.getLabGroups.and.returnValue(of({ count: 0, results: [] }));
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [StorageAccessModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: StorageService, useValue: mockStorageService },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageAccessModal);
    component = fixture.componentInstance;
    component.storageObject = {
      id: 1,
      objectName: 'Test Storage',
      objectType: 'SHELF' as any,
      accessLabGroups: []
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('allLabGroups starts empty', () => {
    expect(component.allLabGroups()).toEqual([]);
  });

  it('selectedLabGroups starts empty', () => {
    expect(component.selectedLabGroups().size).toBe(0);
  });
});
