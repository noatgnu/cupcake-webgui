import { TestBed } from '@angular/core/testing';
import { SidebarControl } from './sidebar-control';

describe('SidebarControl', () => {
  let service: SidebarControl;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidebarControl);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('toggle() should emit on toggle$', (done) => {
    service.toggle$.subscribe(() => {
      done();
    });
    service.toggle();
  });

  it('toggle() should emit each time it is called', () => {
    let emitCount = 0;
    service.toggle$.subscribe(() => emitCount++);
    service.toggle();
    service.toggle();
    service.toggle();
    expect(emitCount).toBe(3);
  });
});
