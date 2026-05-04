import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { WailsService } from './core/services/wails.service';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;

  beforeEach(async () => {
    mockWailsService = jasmine.createSpyObj('WailsService', ['logToFile'], {
      backendStatus: signal(null),
      showSuperuserCreation: signal(false),
      isWails: false
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show superuser modal by default', () => {
    expect(component.showSuperuserModal()).toBeFalse();
  });

  it('should log backend status changes', () => {
    const status = { service: 'django', status: 'ready', message: 'Started' };
    (mockWailsService as any).backendStatus = signal(status);

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(mockWailsService.logToFile).toHaveBeenCalled();
  });
});
