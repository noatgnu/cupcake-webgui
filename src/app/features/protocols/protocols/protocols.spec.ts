import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { Protocols } from './protocols';
import { SidebarControl } from '../../../core/services/sidebar-control';

describe('Protocols', () => {
  let component: Protocols;
  let fixture: ComponentFixture<Protocols>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Protocols],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: SidebarControl, useValue: jasmine.createSpyObj('SidebarControl', ['toggle']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Protocols);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
