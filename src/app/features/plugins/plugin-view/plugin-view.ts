import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PluginPage } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-plugin-view',
  imports: [PluginPage],
  templateUrl: './plugin-view.html',
  styleUrl: './plugin-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginView {}
