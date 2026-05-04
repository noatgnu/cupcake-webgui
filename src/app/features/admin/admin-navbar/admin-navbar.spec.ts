import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { AdminNavbar } from './admin-navbar';

describe('AdminNavbar', () => {
  let component: AdminNavbar;
  let fixture: ComponentFixture<AdminNavbar>;

  beforeEach(async () => {
    const mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);

    await TestBed.configureTestingModule({
      imports: [AdminNavbar],
      providers: [
        provideRouter([]),
        { provide: SidebarControl, useValue: mockSidebarControl }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
