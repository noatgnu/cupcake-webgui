import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';


@Component({
  selector: 'app-admin',
  imports: [RouterOutlet],
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin.scss',
})
export class Admin {

}
