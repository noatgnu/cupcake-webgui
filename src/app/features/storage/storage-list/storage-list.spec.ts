import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { StorageService, ReagentService } from '@noatgnu/cupcake-macaron';
import { StorageList } from './storage-list';

describe('StorageList', () => {
  let component: StorageList;
  let fixture: ComponentFixture<StorageList>;
  let mockStorageService: jasmine.SpyObj<StorageService>;

  beforeEach(async () => {
    mockStorageService = jasmine.createSpyObj('StorageService', [
      'getStorageObjects', 'getStorageObject', 'createStorageObject', 'updateStorageObject',
      'deleteStorageObject', 'getStoragePath'
    ]);
    mockStorageService.getStorageObjects.and.returnValue(of({ count: 0, results: [] }));

    const mockReagentService = jasmine.createSpyObj('ReagentService', [
      'getStoredReagents', 'getStoredReagent', 'getStoragePath'
    ]);
    mockReagentService.getStoredReagents.and.returnValue(of({ count: 0, results: [] }));

    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [StorageList],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: StorageService, useValue: mockStorageService },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('childStorageObjects starts empty', () => {
    expect(component.childStorageObjects()).toEqual([]);
  });

  it('storedReagents starts empty', () => {
    expect(component.storedReagents()).toEqual([]);
  });

  it('loadChildStorageObjects calls StorageService.getStorageObjects', () => {
    expect(mockStorageService.getStorageObjects).toHaveBeenCalled();
  });
});
