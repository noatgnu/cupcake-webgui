import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ProtocolService } from '@noatgnu/cupcake-red-velvet';
import { ProtocolList } from './protocol-list';

describe('ProtocolList', () => {
  let component: ProtocolList;
  let fixture: ComponentFixture<ProtocolList>;
  let mockProtocolService: jasmine.SpyObj<ProtocolService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    mockProtocolService = jasmine.createSpyObj('ProtocolService', ['getProtocols', 'getProtocolsByAccessType', 'deleteProtocol', 'updateProtocol']);
    mockProtocolService.getProtocols.and.returnValue(of({ count: 0, results: [] }));
    mockProtocolService.getProtocolsByAccessType.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [ProtocolList],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: ProtocolService, useValue: mockProtocolService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProtocolList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call getProtocols on init via loadProtocols', () => {
    expect(mockProtocolService.getProtocols).toHaveBeenCalled();
  });

  it('should start with empty protocols signal', () => {
    expect(component.protocols()).toEqual([]);
  });
});
