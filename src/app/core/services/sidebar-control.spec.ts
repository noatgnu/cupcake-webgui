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
});
