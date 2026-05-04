import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugComponent } from './debug.component';
import { WailsService } from '../../core/services/wails.service';
import { signal } from '@angular/core';

describe('DebugComponent', () => {
  let component: DebugComponent;
  let fixture: ComponentFixture<DebugComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;

  beforeEach(async () => {
    mockWailsService = jasmine.createSpyObj('WailsService', [], {
      backendStatus: signal(null),
      backendLog: signal(null),
      isWails: false
    });

    await TestBed.configureTestingModule({
      imports: [DebugComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DebugComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default filter level set to all', () => {
    expect(component.filterLevel).toBe('all');
  });

  it('should have auto scroll enabled by default', () => {
    expect(component.autoScroll).toBeTrue();
  });

  it('should start with zero log count', () => {
    expect(component.logCount()).toBe(0);
  });

  it('should start with empty filtered logs', () => {
    expect(component.filteredLogs().length).toBe(0);
  });

  it('should have default backend status as Initializing', () => {
    expect(component.backendStatus()).toBe('Initializing');
  });

  it('should not show last error by default', () => {
    expect(component.isLastError()).toBeFalse();
  });

  it('should clear logs when clearLogs is called', () => {
    component.clearLogs();
    expect(component.logCount()).toBe(0);
  });

  describe('log filtering', () => {
    it('should return all logs when filter is all', () => {
      component.filterLevel = 'all';
      expect(component.filteredLogs()).toEqual([]);
    });

    it('should filter by info level', () => {
      component.filterLevel = 'info';
      const filtered = component.filteredLogs();
      expect(filtered.every(log => log.type === 'info')).toBeTrue();
    });

    it('should filter by error level', () => {
      component.filterLevel = 'error';
      const filtered = component.filteredLogs();
      expect(filtered.every(log => log.type === 'error')).toBeTrue();
    });
  });
});
