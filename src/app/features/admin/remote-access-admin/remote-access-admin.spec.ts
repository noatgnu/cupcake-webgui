import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { RemoteAccessAdmin } from './remote-access-admin';

describe('RemoteAccessAdmin', () => {
  let component: RemoteAccessAdmin;
  let fixture: ComponentFixture<RemoteAccessAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoteAccessAdmin],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteAccessAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
