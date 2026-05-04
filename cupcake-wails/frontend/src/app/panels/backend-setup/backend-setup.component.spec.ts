import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackendSetupComponent } from './backend-setup.component';
import { WailsService, DownloadProgress, BackendStatus } from '../../core/services/wails.service';
import { signal, WritableSignal } from '@angular/core';

describe('BackendSetupComponent', () => {
  let component: BackendSetupComponent;
  let fixture: ComponentFixture<BackendSetupComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;
  let downloadProgressSignal: WritableSignal<DownloadProgress | null>;
  let backendStatusSignal: WritableSignal<BackendStatus | null>;

  beforeEach(async () => {
    downloadProgressSignal = signal<DownloadProgress | null>(null);
    backendStatusSignal = signal<BackendStatus | null>(null);

    mockWailsService = jasmine.createSpyObj('WailsService', [], {
      downloadProgress: downloadProgressSignal.asReadonly(),
      backendStatus: backendStatusSignal.asReadonly(),
      isWails: false
    });

    await TestBed.configureTestingModule({
      imports: [BackendSetupComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BackendSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have phases defined', () => {
    expect(component.phases.length).toBeGreaterThan(0);
  });

  it('should start at check phase', () => {
    expect(component.currentPhase()).toBe('check');
  });

  it('should have no completed phases initially', () => {
    expect(component.completedPhases().length).toBe(0);
  });

  it('should have no error initially', () => {
    expect(component.error()).toBeNull();
  });

  it('should have default status message', () => {
    expect(component.statusMessage()).toBe('Orchestrating...');
  });

  describe('phases', () => {
    it('should have check phase', () => {
      const phase = component.phases.find(p => p.id === 'check');
      expect(phase).toBeTruthy();
      expect(phase?.name).toBe('Identity Validation');
    });

    it('should have download-backend phase', () => {
      const phase = component.phases.find(p => p.id === 'download-backend');
      expect(phase).toBeTruthy();
      expect(phase?.name).toBe('Core Distribution');
    });

    it('should have python-select phase', () => {
      const phase = component.phases.find(p => p.id === 'python-select');
      expect(phase).toBeTruthy();
    });

    it('should have download-valkey phase', () => {
      const phase = component.phases.find(p => p.id === 'download-valkey');
      expect(phase).toBeTruthy();
    });

    it('should have services phase', () => {
      const phase = component.phases.find(p => p.id === 'services');
      expect(phase).toBeTruthy();
    });

    it('should have complete phase', () => {
      const phase = component.phases.find(p => p.id === 'complete');
      expect(phase).toBeTruthy();
      expect(phase?.name).toBe('System Ready');
    });
  });

  describe('isPhaseCompleted', () => {
    it('should return false for non-completed phase', () => {
      expect(component.isPhaseCompleted('check')).toBeFalse();
    });

    it('should return true for completed phase', () => {
      component.completedPhases.set(['check']);
      expect(component.isPhaseCompleted('check')).toBeTrue();
    });
  });

  describe('download progress', () => {
    it('should update download progress from service', () => {
      const progress: DownloadProgress = { downloaded: 500, total: 1000, percentage: 50, speed: 100 };
      downloadProgressSignal.set(progress);
      fixture.detectChanges();
      expect(component.downloadProgress()).toEqual(progress);
    });
  });

  describe('backend status', () => {
    it('should update status message from service', () => {
      const status: BackendStatus = { service: 'django', status: 'starting', message: 'Starting Django...' };
      backendStatusSignal.set(status);
      fixture.detectChanges();
      expect(component.statusMessage()).toBe('Starting Django...');
    });

    it('should set error on error status', () => {
      const status: BackendStatus = { service: 'django', status: 'error', message: 'Failed to start' };
      backendStatusSignal.set(status);
      fixture.detectChanges();
      expect(component.error()).toBe('Failed to start');
    });
  });

  describe('formatSpeed', () => {
    it('should format zero speed', () => {
      expect(component.formatSpeed(0)).toBe('0 B/s');
    });

    it('should format bytes per second', () => {
      expect(component.formatSpeed(512)).toBe('512.0 B/s');
    });

    it('should format kilobytes per second', () => {
      expect(component.formatSpeed(1024)).toBe('1.0 KB/s');
    });

    it('should format megabytes per second', () => {
      expect(component.formatSpeed(1048576)).toBe('1.0 MB/s');
    });
  });

  describe('retry', () => {
    it('should clear error', () => {
      component.error.set('Some error');
      component.retry();
      expect(component.error()).toBeNull();
    });
  });
});
