import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { PowerAdmin } from './power-admin';

describe('PowerAdmin', () => {
  let component: PowerAdmin;
  let fixture: ComponentFixture<PowerAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PowerAdmin],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PowerAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('shows the appliance power actions', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ccc-appliance-power')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('ccc-appliance-power button[data-action]').length).toBe(3);
  });
});
