import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { StorageNavbar } from './storage-navbar';

describe('StorageNavbar', () => {
  let component: StorageNavbar;
  let fixture: ComponentFixture<StorageNavbar>;

  beforeEach(async () => {
    const mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);

    await TestBed.configureTestingModule({
      imports: [StorageNavbar],
      providers: [
        provideRouter([]),
        { provide: SidebarControl, useValue: mockSidebarControl }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
