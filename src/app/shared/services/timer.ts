import { Injectable } from '@angular/core';
import type { TimeKeeper } from '@noatgnu/cupcake-red-velvet';

interface LocalTimerState {
  duration: number;
  current: number;
  started: boolean;
  startTime: number;
  spent: number;
  previousStop: number;
}

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  currentTrackingStep: number[] = [];
  remoteTimeKeeper: { [key: string]: TimeKeeper } = {};
  timeKeeper: { [key: string]: LocalTimerState } = {};
  private timeTick: number = 0;
  private calculatingTime: boolean = false;

  constructor() {
    this.timeTick = window.setInterval(() => {
      if (this.calculatingTime) {
        return;
      }
      const timeNow = Date.now();
      this.calculatingTime = true;
      Object.keys(this.timeKeeper).forEach(i => {
        if (this.timeKeeper[i].started && this.timeKeeper[i].current > 0) {
          if (timeNow < this.timeKeeper[i].startTime) {
            this.timeKeeper[i].startTime = timeNow;
          }
          this.timeKeeper[i].spent = (timeNow - this.timeKeeper[i].startTime) / 1000;
          this.timeKeeper[i].current = this.timeKeeper[i].previousStop - this.timeKeeper[i].spent;

          if (this.timeKeeper[i].current <= 0) {
            this.timeKeeper[i].current = 0;
            this.timeKeeper[i].started = false;
          } else {
            this.timeKeeper[i].current = parseFloat(this.timeKeeper[i].current.toFixed(2));
          }
        }
      });
      this.calculatingTime = false;
    }, 100);
  }

  convertTime(time: number | null): string {
    if (time === null || time === undefined) {
      time = 0;
    }
    let minutes = Math.floor(time / 60);
    let seconds = time - minutes * 60;
    let hours = Math.floor(minutes / 60);
    minutes = minutes - hours * 60;
    let secondsString = seconds.toFixed(2).toString();
    if (secondsString.length === 1) {
      secondsString = `0${secondsString}`;
    }
    let minutesString = minutes.toString();
    if (minutesString.length === 1) {
      minutesString = `0${minutesString}`;
    }
    let hoursString = hours.toString();
    if (hoursString.length === 1) {
      hoursString = `0${hoursString}`;
    }
    return `${hoursString}:${minutesString}:${secondsString}`;
  }

  initializeTimer(stepId: number, duration: number): void {
    if (!this.timeKeeper[stepId.toString()]) {
      this.timeKeeper[stepId.toString()] = {
        duration: duration,
        current: duration,
        started: false,
        startTime: 0,
        spent: 0,
        previousStop: duration
      };
    }
  }

  getProgressPercentage(stepId: number): number {
    if (!this.timeKeeper[stepId.toString()]) return 0;
    const timeKeeper = this.timeKeeper[stepId.toString()];
    const elapsed = timeKeeper.duration - timeKeeper.current;
    return Math.round((elapsed / timeKeeper.duration) * 100);
  }

  getProgressType(stepId: number): string {
    const percentage = this.getProgressPercentage(stepId);
    if (percentage < 25) return 'info';
    if (percentage < 50) return 'primary';
    if (percentage < 75) return 'warning';
    return 'danger';
  }

  ngOnDestroy(): void {
    if (this.timeTick) {
      clearInterval(this.timeTick);
    }
  }
}
