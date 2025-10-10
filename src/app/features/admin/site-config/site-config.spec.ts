import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SiteConfig } from './site-config';

describe('SiteConfig', () => {
  let component: SiteConfig;
  let fixture: ComponentFixture<SiteConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteConfig]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SiteConfig);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
