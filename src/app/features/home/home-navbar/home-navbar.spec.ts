import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeNavbar } from './home-navbar';
import { SidebarControl } from '../../../core/services/sidebar-control';

describe('HomeNavbar', () => {
  let component: HomeNavbar;
  let fixture: ComponentFixture<HomeNavbar>;
  let mockSidebarControl: jasmine.SpyObj<SidebarControl>;

  beforeEach(async () => {
    mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);

    await TestBed.configureTestingModule({
      imports: [HomeNavbar],
      providers: [
        { provide: SidebarControl, useValue: mockSidebarControl }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeNavbar);
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

  it('navigateToSection() emits sectionChange', () => {
    let emittedSection: string | undefined;
    component.sectionChange.subscribe(section => emittedSection = section);
    component.navigateToSection('projects');
    expect(emittedSection).toBe('projects');
  });
});
