import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { StorageAdmin } from './storage-admin';

describe('StorageAdmin', () => {
  let component: StorageAdmin;
  let fixture: ComponentFixture<StorageAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageAdmin],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
