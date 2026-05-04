import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { StorageService, ReagentService } from '@noatgnu/cupcake-macaron';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { Storage } from './storage';

describe('Storage', () => {
  let component: Storage;
  let fixture: ComponentFixture<Storage>;

  beforeEach(async () => {
    const mockStorageService = jasmine.createSpyObj('StorageService', [
      'getStorageObjects', 'getStorageObject', 'createStorageObject', 'updateStorageObject', 'deleteStorageObject'
    ]);
    mockStorageService.getStorageObjects.and.returnValue(of({ count: 0, results: [] }));

    const mockReagentService = jasmine.createSpyObj('ReagentService', ['getStoredReagents', 'getStoredReagent']);
    mockReagentService.getStoredReagents.and.returnValue(of({ count: 0, results: [] }));

    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);
    const mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);

    await TestBed.configureTestingModule({
      imports: [Storage],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: StorageService, useValue: mockStorageService },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: SidebarControl, useValue: mockSidebarControl }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Storage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
