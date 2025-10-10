import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabGroupList } from './lab-group-list';

describe('LabGroupList', () => {
  let component: LabGroupList;
  let fixture: ComponentFixture<LabGroupList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabGroupList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabGroupList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
