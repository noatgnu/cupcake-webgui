import { Pipe, PipeTransform } from '@angular/core';
import type { StepReagent } from '@noatgnu/cupcake-red-velvet';

@Pipe({
  name: 'stepTemplate',
  standalone: true
})
export class StepTemplatePipe implements PipeTransform {

  transform(htmlContent: string | null | undefined, reagents: StepReagent[], scalingFactor: number = 1): string {
    if (!htmlContent) {
      return '';
    }

    if (!reagents || reagents.length === 0) {
      return htmlContent;
    }

    let processedContent = htmlContent;

    reagents.forEach(reagent => {
      const baseQuantity = reagent.quantity;
      const scaledQuantity = reagent.scalable && reagent.scaledQuantity !== undefined
        ? reagent.scaledQuantity * scalingFactor
        : baseQuantity * (reagent.scalable ? reagent.scalableFactor * scalingFactor : 1);

      processedContent = processedContent.replace(
        new RegExp(`%${reagent.id}\\.quantity%`, 'g'),
        `<span class="template-value" title="Reagent quantity: ${reagent.reagentName}">${baseQuantity}</span>`
      );
      processedContent = processedContent.replace(
        new RegExp(`%${reagent.id}\\.scaled_quantity%`, 'g'),
        `<span class="template-value template-value-scaled" title="Scaled quantity: ${reagent.reagentName}">${scaledQuantity}</span>`
      );
      processedContent = processedContent.replace(
        new RegExp(`%${reagent.id}\\.name%`, 'g'),
        `<span class="template-value template-value-name" title="Reagent name">${reagent.reagentName || 'Unknown'}</span>`
      );
      processedContent = processedContent.replace(
        new RegExp(`%${reagent.id}\\.unit%`, 'g'),
        `<span class="template-value template-value-unit" title="Reagent unit: ${reagent.reagentName}">${reagent.reagentUnit || ''}</span>`
      );
    });

    return processedContent;
  }

}
