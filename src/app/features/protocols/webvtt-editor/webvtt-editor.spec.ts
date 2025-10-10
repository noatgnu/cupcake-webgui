import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebvttEditor } from './webvtt-editor';

describe('WebvttEditor', () => {
  let component: WebvttEditor;
  let fixture: ComponentFixture<WebvttEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebvttEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebvttEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should parse WebVTT content correctly', () => {
    const vttContent = `WEBVTT

00:00.000 --> 00:02.000
First caption

00:02.000 --> 00:05.000
Second caption`;

    component.vttContent = vttContent;

    expect(component.cues().length).toBe(2);
    expect(component.cues()[0].text).toBe('First caption');
    expect(component.cues()[0].startTime).toBe(0);
    expect(component.cues()[0].endTime).toBe(2);
    expect(component.cues()[1].text).toBe('Second caption');
    expect(component.cues()[1].startTime).toBe(2);
    expect(component.cues()[1].endTime).toBe(5);
  });

  it('should parse timestamps correctly', () => {
    expect(component.parseTimestamp('00:00.000')).toBe(0);
    expect(component.parseTimestamp('00:02.500')).toBe(2.5);
    expect(component.parseTimestamp('01:30.000')).toBe(90);
    expect(component.parseTimestamp('01:00:00.000')).toBe(3600);
  });

  it('should format timestamps correctly', () => {
    expect(component.formatTimestamp(0)).toBe('00:00.000');
    expect(component.formatTimestamp(2.5)).toBe('00:02.500');
    expect(component.formatTimestamp(90)).toBe('01:30.000');
    expect(component.formatTimestamp(3600)).toBe('01:00:00.000');
  });

  it('should identify active cues based on current time', () => {
    const vttContent = `WEBVTT

00:00.000 --> 00:02.000
First caption

00:02.000 --> 00:05.000
Second caption`;

    component.vttContent = vttContent;
    component.currentTime.set(1);

    const activeCues = component.activeCues();
    expect(activeCues.length).toBe(1);
    expect(activeCues[0].text).toBe('First caption');
  });

  it('should convert cues back to VTT format', () => {
    const vttContent = `WEBVTT

00:00.000 --> 00:02.000
First caption

00:02.000 --> 00:05.000
Second caption`;

    component.vttContent = vttContent;
    const output = component.toVTT();

    expect(output).toContain('WEBVTT');
    expect(output).toContain('00:00.000 --> 00:02.000');
    expect(output).toContain('First caption');
    expect(output).toContain('00:02.000 --> 00:05.000');
    expect(output).toContain('Second caption');
  });

  it('should add new cue', () => {
    component.addCue();

    expect(component.cues().length).toBe(1);
    expect(component.editingCueId()).toBe(component.cues()[0].id);
  });

  it('should update cue text', () => {
    const vttContent = `WEBVTT

00:00.000 --> 00:02.000
First caption`;

    component.vttContent = vttContent;
    const cueId = component.cues()[0].id;

    component.updateCueText(cueId, 'Updated caption');

    expect(component.cues()[0].text).toBe('Updated caption');
  });

  it('should delete cue', () => {
    const vttContent = `WEBVTT

00:00.000 --> 00:02.000
First caption

00:02.000 --> 00:05.000
Second caption`;

    component.vttContent = vttContent;
    const cueId = component.cues()[0].id;

    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteCue(cueId);

    expect(component.cues().length).toBe(1);
    expect(component.cues()[0].text).toBe('Second caption');
  });
});
