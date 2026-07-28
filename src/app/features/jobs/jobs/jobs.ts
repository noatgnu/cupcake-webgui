import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { JobsNavbar } from '../jobs-navbar/jobs-navbar';

@Component({
  selector: 'app-jobs',
  imports: [JobsNavbar, RouterOutlet],
  templateUrl: './jobs.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './jobs.scss'
})
export class Jobs {

}
