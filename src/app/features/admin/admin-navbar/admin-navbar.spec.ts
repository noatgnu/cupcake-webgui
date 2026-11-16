import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '@noatgnu/cupcake-core';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { AdminNavbar } from './admin-navbar';

describe('AdminNavbar', () => {
  let component: AdminNavbar;
  let fixture: ComponentFixture<AdminNavbar>;
  const currentUser = signal<any>({ isStaff: true, isSuperuser: false });

  beforeEach(async () => {
    const mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);
    currentUser.set({ isStaff: true, isSuperuser: false });

    await TestBed.configureTestingModule({
      imports: [AdminNavbar],
      providers: [
        provideRouter([]),
        { provide: SidebarControl, useValue: mockSidebarControl },
        { provide: AuthService, useValue: { currentUser } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to the power page only for superusers on an appliance', () => {
    component.isAppliance = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/power"]')).toBeNull();

    currentUser.set({ isStaff: true, isSuperuser: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/power"]')).not.toBeNull();

    component.isAppliance = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/power"]')).toBeNull();
  });
});
