import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AsyncTaskUIService } from '@noatgnu/cupcake-vanilla';
import { AsyncTaskFloatingPanel } from './async-task-floating-panel';

describe('AsyncTaskFloatingPanel', () => {
  let component: AsyncTaskFloatingPanel;
  let fixture: ComponentFixture<AsyncTaskFloatingPanel>;

  beforeEach(async () => {
    const mockTaskUIService = jasmine.createSpyObj('AsyncTaskUIService', ['startRealtimeUpdates'], {
      tasks: signal([]),
      activeTasks: signal([])
    });

    await TestBed.configureTestingModule({
      imports: [AsyncTaskFloatingPanel],
      providers: [
        provideRouter([]),
        { provide: AsyncTaskUIService, useValue: mockTaskUIService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AsyncTaskFloatingPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('activeTasks starts empty', () => {
    expect(component.activeTasks()).toEqual([]);
  });

  it('isMinimized starts as false', () => {
    expect(component.isMinimized()).toBeFalse();
  });

  it('toggleMinimize() toggles isMinimized', () => {
    component.toggleMinimize();
    expect(component.isMinimized()).toBeTrue();
  });
});
