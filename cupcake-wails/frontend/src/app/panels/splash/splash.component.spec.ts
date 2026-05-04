import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SplashComponent } from './splash.component';
import { WailsService } from '../../core/services/wails.service';
import { signal } from '@angular/core';

describe('SplashComponent', () => {
  let component: SplashComponent;
  let fixture: ComponentFixture<SplashComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;

  beforeEach(async () => {
    mockWailsService = jasmine.createSpyObj('WailsService', ['getAppVersion'], {
      backendStatus: signal(null),
      backendLog: signal(null),
      isWails: false
    });
    mockWailsService.getAppVersion.and.returnValue(Promise.resolve('1.0.0'));

    await TestBed.configureTestingModule({
      imports: [SplashComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SplashComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default version', () => {
    expect(component.version).toBe('0.0.1');
  });

  it('should initialize with all services in pending state', () => {
    const services = component.services();
    expect(services.length).toBeGreaterThan(0);

    const pendingServices = services.filter(s => s.status === 'pending');
    expect(pendingServices.length).toBe(services.length);
  });

  it('should have database service in list', () => {
    const services = component.services();
    const dbService = services.find(s => s.name === 'database');
    expect(dbService).toBeTruthy();
    expect(dbService?.displayName).toBe('Database');
  });

  it('should have python service in list', () => {
    const services = component.services();
    const pythonService = services.find(s => s.name === 'python');
    expect(pythonService).toBeTruthy();
    expect(pythonService?.displayName).toBe('Python');
  });

  it('should have redis service in list', () => {
    const services = component.services();
    const redisService = services.find(s => s.name === 'redis');
    expect(redisService).toBeTruthy();
    expect(redisService?.displayName).toBe('Redis Server');
  });

  it('should have django service in list', () => {
    const services = component.services();
    const djangoService = services.find(s => s.name === 'django');
    expect(djangoService).toBeTruthy();
    expect(djangoService?.displayName).toBe('Django Server');
  });

  it('should have rq service in list', () => {
    const services = component.services();
    const rqService = services.find(s => s.name === 'rq');
    expect(rqService).toBeTruthy();
    expect(rqService?.displayName).toBe('RQ Worker');
  });

  it('should have empty recent logs initially', () => {
    expect(component.recentLogs().length).toBe(0);
  });

  it('should limit recent logs to 20', () => {
    expect(component.recentLogs().length).toBeLessThanOrEqual(20);
  });

  describe('service status display', () => {
    it('should display pending icon for pending status', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const pendingIcons = compiled.querySelectorAll('.service-item.pending .service-icon');
      expect(pendingIcons.length).toBeGreaterThan(0);
    });
  });
});
