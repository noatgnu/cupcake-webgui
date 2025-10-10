import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'durationFormat',
  standalone: true
})
export class DurationFormatPipe implements PipeTransform {

  transform(totalSeconds: number | null | undefined): string {
    if (totalSeconds === null || totalSeconds === undefined || totalSeconds === 0) {
      return '0s';
    }

    let remaining = totalSeconds;
    const parts: string[] = [];

    const days = Math.floor(remaining / 86400);
    if (days > 0) {
      parts.push(`${days}d`);
      remaining -= days * 86400;
    }

    const hours = Math.floor(remaining / 3600);
    if (hours > 0) {
      parts.push(`${hours}h`);
      remaining -= hours * 3600;
    }

    const minutes = Math.floor(remaining / 60);
    if (minutes > 0) {
      parts.push(`${minutes}m`);
      remaining -= minutes * 60;
    }

    if (remaining > 0 || parts.length === 0) {
      parts.push(`${remaining}s`);
    }

    return parts.join(' ');
  }

}
