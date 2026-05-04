import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { JobsNavbar } from './jobs-navbar';
import { SidebarControl } from '../../../core/services/sidebar-control';

describe('JobsNavbar', () => {
  let component: JobsNavbar;
  let fixture: ComponentFixture<JobsNavbar>;
  let mockSidebarControl: jasmine.SpyObj<SidebarControl>;

  beforeEach(async () => {
    mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);

    await TestBed.configureTestingModule({
      imports: [JobsNavbar],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: SidebarControl, useValue: mockSidebarControl }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JobsNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('onToggleSidebar() calls SidebarControl.toggle()', () => {
    component.onToggleSidebar();
    expect(mockSidebarControl.toggle).toHaveBeenCalled();
  });
});
