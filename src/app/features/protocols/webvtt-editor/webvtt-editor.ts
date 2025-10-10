import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface WebVTTCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

@Component({
  selector: 'app-webvtt-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './webvtt-editor.html',
  styleUrl: './webvtt-editor.scss'
})
export class WebvttEditor {
  @Input() set vttContent(content: string | undefined) {
    if (content) {
      this.parseVTT(content);
    }
  }

  @Input() set externalCurrentTime(time: number | undefined) {
    if (time !== undefined) {
      this.currentTime.set(time);
    }
  }

  @Input() mediaUrl?: string;
  @Input() editable = true;

  @Output() contentChanged = new EventEmitter<string>();

  cues = signal<WebVTTCue[]>([]);
  currentTime = signal(0);
  playing = signal(false);
  editingCueId = signal<string | null>(null);

  activeCues = computed(() => {
    const time = this.currentTime();
    return this.cues().filter(cue => time >= cue.startTime && time <= cue.endTime);
  });

  parseVTT(content: string): void {
    const lines = content.split('\n');
    const parsedCues: WebVTTCue[] = [];
    let currentCue: Partial<WebVTTCue> | null = null;
    let cueCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === 'WEBVTT') {
        continue;
      }

      if (line.includes('-->')) {
        if (currentCue && currentCue.text) {
          parsedCues.push(currentCue as WebVTTCue);
        }

        const [startStr, endStr] = line.split('-->').map(s => s.trim());
        const startTime = this.parseTimestamp(startStr);
        const endTime = this.parseTimestamp(endStr);

        currentCue = {
          id: `cue-${++cueCounter}`,
          startTime,
          endTime,
          text: ''
        };
      } else if (currentCue && line !== '') {
        if (!currentCue.text) {
          currentCue.text = line;
        } else {
          currentCue.text += '\n' + line;
        }
      }
    }

    if (currentCue && currentCue.text) {
      parsedCues.push(currentCue as WebVTTCue);
    }

    this.cues.set(parsedCues);
  }

  parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    let seconds = 0;

    if (parts.length === 3) {
      const [hours, minutes, secs] = parts;
      seconds = parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseFloat(secs);
    } else if (parts.length === 2) {
      const [minutes, secs] = parts;
      seconds = parseInt(minutes, 10) * 60 + parseFloat(secs);
    } else {
      seconds = parseFloat(parts[0]);
    }

    return seconds;
  }

  formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(3);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
    }
  }

  onTimeUpdate(event: Event): void {
    const media = event.target as HTMLMediaElement;
    this.currentTime.set(media.currentTime);
  }

  onPlayStateChange(event: Event): void {
    const media = event.target as HTMLMediaElement;
    this.playing.set(!media.paused);
  }

  seekTo(time: number): void {
    const mediaElement = document.querySelector('audio, video') as HTMLMediaElement;
    if (mediaElement) {
      mediaElement.currentTime = time;
    }
  }

  editCue(cueId: string): void {
    this.editingCueId.set(cueId);
  }

  saveCue(cue: WebVTTCue): void {
    this.editingCueId.set(null);
    this.emitChanges();
  }

  cancelEdit(): void {
    this.editingCueId.set(null);
  }

  updateCueText(cueId: string, newText: string): void {
    const updatedCues = this.cues().map(cue =>
      cue.id === cueId ? { ...cue, text: newText } : cue
    );
    this.cues.set(updatedCues);
  }

  updateCueTime(cueId: string, field: 'startTime' | 'endTime', value: string): void {
    const timeValue = this.parseTimestamp(value);
    const updatedCues = this.cues().map(cue =>
      cue.id === cueId ? { ...cue, [field]: timeValue } : cue
    );
    this.cues.set(updatedCues);
  }

  deleteCue(cueId: string): void {
    if (confirm('Are you sure you want to delete this cue?')) {
      const updatedCues = this.cues().filter(cue => cue.id !== cueId);
      this.cues.set(updatedCues);
      this.emitChanges();
    }
  }

  addCue(): void {
    const lastCue = this.cues()[this.cues().length - 1];
    const startTime = lastCue ? lastCue.endTime + 1 : 0;
    const newCue: WebVTTCue = {
      id: `cue-${Date.now()}`,
      startTime,
      endTime: startTime + 5,
      text: 'New caption'
    };

    this.cues.set([...this.cues(), newCue]);
    this.editingCueId.set(newCue.id);
  }

  emitChanges(): void {
    const vttContent = this.toVTT();
    this.contentChanged.emit(vttContent);
  }

  toVTT(): string {
    let vtt = 'WEBVTT\n\n';

    this.cues().forEach(cue => {
      vtt += `${this.formatTimestamp(cue.startTime)} --> ${this.formatTimestamp(cue.endTime)}\n`;
      vtt += `${cue.text}\n\n`;
    });

    return vtt;
  }

  isActive(cue: WebVTTCue): boolean {
    const time = this.currentTime();
    return time >= cue.startTime && time <= cue.endTime;
  }
}
