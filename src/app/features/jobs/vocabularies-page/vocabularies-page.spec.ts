import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterLink, provideRouter } from '@angular/router';

import { VocabulariesPage } from './vocabularies-page';

describe('VocabulariesPage', () => {
  let fixture: ComponentFixture<VocabulariesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VocabulariesPage],
      providers: [provideRouter([])]
    })
      .overrideComponent(VocabulariesPage, { set: { imports: [RouterLink], schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
      .compileComponents();
    fixture = TestBed.createComponent(VocabulariesPage);
    fixture.detectChanges();
  });

  it('shows the breadcrumb back to Jobs', () => {
    const link = fixture.nativeElement.querySelector('.breadcrumb-item a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Jobs');
    expect(link.getAttribute('href')).toBe('/jobs');
    expect(fixture.nativeElement.querySelector('.breadcrumb-item.active').textContent.trim()).toBe('Vocabularies');
  });
});
