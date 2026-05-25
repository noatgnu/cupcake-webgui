import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { BackupAdmin } from './backup-admin';

describe('BackupAdmin', () => {
  let component: BackupAdmin;
  let fixture: ComponentFixture<BackupAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackupAdmin],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BackupAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
