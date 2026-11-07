import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VocabularyManager } from '@noatgnu/cupcake-vanilla';

@Component({
  selector: 'app-vocabularies-page',
  imports: [RouterLink, VocabularyManager],
  templateUrl: './vocabularies-page.html',
  styleUrl: './vocabularies-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VocabulariesPage {}
