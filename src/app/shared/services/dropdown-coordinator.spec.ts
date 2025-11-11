import { TestBed } from '@angular/core/testing';

import { DropdownCoordinator } from './dropdown-coordinator';

describe('DropdownCoordinator', () => {
  let service: DropdownCoordinator;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DropdownCoordinator);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
