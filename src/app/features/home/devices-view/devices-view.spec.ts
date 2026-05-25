import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';

import { DevicesView } from './devices-view';

describe('DevicesView', () => {
  let component: DevicesView;
  let fixture: ComponentFixture<DevicesView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DevicesView],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DevicesView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
