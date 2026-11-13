import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { PluginView } from './plugin-view';

describe('PluginView', () => {
  let fixture: ComponentFixture<PluginView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PluginView] })
      .overrideComponent(PluginView, { set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
      .compileComponents();
    fixture = TestBed.createComponent(PluginView);
    fixture.detectChanges();
  });

  it('shows the plugin page', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('ccc-plugin-page')).toBeTruthy();
  });
});
