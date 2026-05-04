import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PythonSelectionComponent } from './python-selection.component';
import { WailsService, PythonCandidate, ValidationResult } from '../../core/services/wails.service';

describe('PythonSelectionComponent', () => {
  let component: PythonSelectionComponent;
  let fixture: ComponentFixture<PythonSelectionComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;

  const mockCandidates: PythonCandidate[] = [
    { command: 'python3.12', version: '3.12.0', path: '/usr/bin/python3.12' },
    { command: 'python3.11', version: '3.11.0', path: '/usr/bin/python3.11' }
  ];

  beforeEach(async () => {
    mockWailsService = jasmine.createSpyObj('WailsService', [
      'detectPythonCandidates',
      'verifyPython',
      'selectPython',
      'openFile'
    ], {
      isWails: false
    });

    mockWailsService.detectPythonCandidates.and.resolveTo(mockCandidates);
    mockWailsService.selectPython.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [PythonSelectionComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PythonSelectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be loading initially', () => {
    expect(component.loading()).toBeTrue();
  });

  it('should have create venv enabled by default', () => {
    expect(component.createNewVenv).toBeTrue();
  });

  describe('ngOnInit', () => {
    it('should load python candidates', async () => {
      await component.ngOnInit();
      expect(mockWailsService.detectPythonCandidates).toHaveBeenCalled();
      expect(component.candidates()).toEqual(mockCandidates);
    });

    it('should auto-select first candidate', async () => {
      await component.ngOnInit();
      expect(component.selectedPath()).toBe('/usr/bin/python3.12');
    });

    it('should stop loading after init', async () => {
      await component.ngOnInit();
      expect(component.loading()).toBeFalse();
    });

    it('should handle empty candidates', async () => {
      mockWailsService.detectPythonCandidates.and.resolveTo([]);
      await component.ngOnInit();
      expect(component.selectedPath()).toBe('');
    });
  });

  describe('selectCandidate', () => {
    it('should set selected path', () => {
      const candidate = mockCandidates[1];
      component.selectCandidate(candidate);
      expect(component.selectedPath()).toBe('/usr/bin/python3.11');
    });

    it('should clear custom path', () => {
      component.customPath = '/custom/python';
      component.selectCandidate(mockCandidates[0]);
      expect(component.customPath).toBe('');
    });

    it('should clear validation result', () => {
      component.validationResult.set({ valid: true, message: 'OK', version: '3.12' });
      component.selectCandidate(mockCandidates[0]);
      expect(component.validationResult()).toBeNull();
    });
  });

  describe('onCustomPathChange', () => {
    it('should clear selected path', () => {
      component.selectedPath.set('/usr/bin/python3.12');
      component.onCustomPathChange();
      expect(component.selectedPath()).toBe('');
    });

    it('should clear validation result', () => {
      component.validationResult.set({ valid: true, message: 'OK', version: '3.12' });
      component.onCustomPathChange();
      expect(component.validationResult()).toBeNull();
    });
  });

  describe('verifyCustomPath', () => {
    it('should not verify empty path', async () => {
      component.customPath = '';
      await component.verifyCustomPath();
      expect(mockWailsService.verifyPython).not.toHaveBeenCalled();
    });

    it('should verify custom path', async () => {
      const result: ValidationResult = { valid: true, message: 'Valid', version: '3.12.0' };
      mockWailsService.verifyPython.and.resolveTo(result);

      component.customPath = '/custom/python';
      await component.verifyCustomPath();

      expect(mockWailsService.verifyPython).toHaveBeenCalledWith('/custom/python');
      expect(component.validationResult()).toEqual(result);
    });
  });

  describe('browseForPython', () => {
    it('should set custom path from file dialog', async () => {
      mockWailsService.openFile.and.resolveTo('/selected/python');
      mockWailsService.verifyPython.and.resolveTo({ valid: true, message: 'OK', version: '3.12' });

      await component.browseForPython();

      expect(component.customPath).toBe('/selected/python');
      expect(mockWailsService.verifyPython).toHaveBeenCalled();
    });

    it('should not set path when dialog cancelled', async () => {
      mockWailsService.openFile.and.resolveTo('');

      await component.browseForPython();

      expect(component.customPath).toBe('');
    });
  });

  describe('canProceed', () => {
    it('should be true with selected path', async () => {
      await component.ngOnInit();
      expect(component.canProceed()).toBeTrue();
    });

    it('should be false with no selection', () => {
      component.selectedPath.set('');
      component.customPath = '';
      expect(component.canProceed()).toBeFalse();
    });

    it('should be true with valid custom path', () => {
      component.selectedPath.set('');
      component.customPath = '/custom/python';
      component.validationResult.set({ valid: true, message: 'OK', version: '3.12' });
      expect(component.canProceed()).toBeTrue();
    });

    it('should be false with invalid custom path', () => {
      component.selectedPath.set('');
      component.customPath = '/custom/python';
      component.validationResult.set({ valid: false, message: 'Invalid' });
      expect(component.canProceed()).toBeFalse();
    });
  });

  describe('proceed', () => {
    it('should call selectPython with selected path', async () => {
      await component.ngOnInit();
      await component.proceed();
      expect(mockWailsService.selectPython).toHaveBeenCalledWith('/usr/bin/python3.12', true);
    });

    it('should call selectPython with custom path', async () => {
      component.selectedPath.set('');
      component.customPath = '/custom/python';
      component.createNewVenv = false;
      await component.proceed();
      expect(mockWailsService.selectPython).toHaveBeenCalledWith('/custom/python', false);
    });

    it('should not proceed without path', async () => {
      component.selectedPath.set('');
      component.customPath = '';
      await component.proceed();
      expect(mockWailsService.selectPython).not.toHaveBeenCalled();
    });
  });
});
