import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { BillingNavbar } from './billing-navbar';
import { SidebarControl } from '../../../core/services/sidebar-control';

describe('BillingNavbar', () => {
  let component: BillingNavbar;
  let fixture: ComponentFixture<BillingNavbar>;
  let mockSidebarControl: jasmine.SpyObj<SidebarControl>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);
    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [BillingNavbar],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: SidebarControl, useValue: mockSidebarControl },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BillingNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('onToggleSidebar() should call SidebarControl.toggle()', () => {
    component.onToggleSidebar();
    expect(mockSidebarControl.toggle).toHaveBeenCalled();
  });

  it('openQuoteRequest() should open modal', () => {
    mockModalService.open.and.returnValue({ result: Promise.resolve() } as any);
    component.openQuoteRequest();
    expect(mockModalService.open).toHaveBeenCalled();
  });
});
