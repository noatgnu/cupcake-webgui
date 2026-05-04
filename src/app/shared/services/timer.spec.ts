import { TestBed } from '@angular/core/testing';
import { TimerService } from './timer';

describe('TimerService', () => {
  let service: TimerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimerService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize timer with correct state', () => {
    service.initializeTimer(1, 300);
    expect(service.timeKeeper['1']).toBeDefined();
    expect(service.timeKeeper['1'].duration).toBe(300);
    expect(service.timeKeeper['1'].current).toBe(300);
    expect(service.timeKeeper['1'].started).toBeFalse();
  });

  it('should not reinitialize an existing timer', () => {
    service.initializeTimer(1, 300);
    service.timeKeeper['1'].current = 150;
    service.initializeTimer(1, 300);
    expect(service.timeKeeper['1'].current).toBe(150);
  });

  it('getProgressPercentage() returns 0 when timer not initialized', () => {
    expect(service.getProgressPercentage(999)).toBe(0);
  });

  it('getProgressPercentage() returns 0 when timer just initialized', () => {
    service.initializeTimer(1, 100);
    expect(service.getProgressPercentage(1)).toBe(0);
  });

  it('getProgressPercentage() returns correct percentage when time has elapsed', () => {
    service.initializeTimer(1, 100);
    service.timeKeeper['1'].current = 75;
    expect(service.getProgressPercentage(1)).toBe(25);
  });

  it('getProgressType() returns info when percentage < 25', () => {
    service.initializeTimer(1, 100);
    service.timeKeeper['1'].current = 90;
    expect(service.getProgressType(1)).toBe('info');
  });

  it('getProgressType() returns primary when percentage 25-49', () => {
    service.initializeTimer(1, 100);
    service.timeKeeper['1'].current = 60;
    expect(service.getProgressType(1)).toBe('primary');
  });

  it('getProgressType() returns warning when percentage 50-74', () => {
    service.initializeTimer(1, 100);
    service.timeKeeper['1'].current = 40;
    expect(service.getProgressType(1)).toBe('warning');
  });

  it('getProgressType() returns danger when percentage >= 75', () => {
    service.initializeTimer(1, 100);
    service.timeKeeper['1'].current = 10;
    expect(service.getProgressType(1)).toBe('danger');
  });

  it('convertTime() formats zero correctly', () => {
    expect(service.convertTime(0)).toBe('00:00:0.00');
  });

  it('convertTime() formats 90 seconds as 1 minute 30 seconds', () => {
    expect(service.convertTime(90)).toBe('00:01:30.00');
  });

  it('convertTime() handles null', () => {
    expect(service.convertTime(null)).toBe('00:00:0.00');
  });
});
