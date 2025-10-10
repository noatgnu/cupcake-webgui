import { StepTemplatePipe } from './step-template-pipe';
import type { StepReagent } from '@noatgnu/cupcake-red-velvet';

describe('StepTemplatePipe', () => {
  let pipe: StepTemplatePipe;

  const mockReagents: StepReagent[] = [
    {
      id: 1,
      step: 1,
      reagent: 10,
      reagentName: 'Water',
      reagentUnit: 'mL',
      quantity: 100,
      scalable: false,
      scalableFactor: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 2,
      step: 1,
      reagent: 20,
      reagentName: 'Salt',
      reagentUnit: 'g',
      quantity: 50,
      scalable: true,
      scalableFactor: 2,
      scaledQuantity: 100,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 3,
      step: 1,
      reagent: 30,
      reagentName: 'Buffer',
      reagentUnit: undefined,
      quantity: 25,
      scalable: false,
      scalableFactor: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
  ];

  beforeEach(() => {
    pipe = new StepTemplatePipe();
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return empty string for null or undefined content', () => {
    expect(pipe.transform(null, [])).toBe('');
    expect(pipe.transform(undefined, [])).toBe('');
  });

  it('should return original content when no reagents provided', () => {
    const content = '<p>Add %1.name% to the solution</p>';
    expect(pipe.transform(content, [])).toBe(content);
  });

  it('should replace reagent name template', () => {
    const content = '<p>Use %1.name% in this step</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe('<p>Use Water in this step</p>');
  });

  it('should replace reagent quantity template', () => {
    const content = '<p>Measure %1.quantity% precisely</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe('<p>Measure 100 precisely</p>');
  });

  it('should replace reagent unit template', () => {
    const content = '<p>The unit is %1.unit%</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe('<p>The unit is mL</p>');
  });

  it('should replace reagent scaled quantity template', () => {
    const content = '<p>Scaled quantity: %2.scaled_quantity%</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe('<p>Scaled quantity: 100</p>');
  });

  it('should handle multiple templates in same content', () => {
    const content = '<p>Mix %1.name% with %2.name%</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe('<p>Mix Water with Salt</p>');
  });

  it('should handle reagent without unit', () => {
    const content = '<p>Add %3.quantity% %3.unit% of %3.name%</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe('<p>Add 25  of Buffer</p>');
  });

  it('should not replace non-existent reagent templates', () => {
    const content = '<p>Add %999.name% to solution</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe('<p>Add %999.name% to solution</p>');
  });

  it('should handle complex HTML with multiple templates', () => {
    const content = `
      <h3>Protocol Step</h3>
      <p>First, add %1.quantity% %1.unit% of %1.name% to the beaker.</p>
      <p>Then, measure %2.quantity%%2.unit% of %2.name%.</p>
      <ul>
        <li>%1.name%: %1.quantity%%1.unit%</li>
        <li>%2.name%: %2.quantity%%2.unit%</li>
      </ul>
    `;
    const result = pipe.transform(content, mockReagents);
    expect(result).toContain('100 mL of Water');
    expect(result).toContain('50g of Salt');
    expect(result).toContain('Water: 100mL');
    expect(result).toContain('Salt: 50g');
  });

  it('should not modify content without templates', () => {
    const content = '<p>This is a regular step description without templates.</p>';
    const result = pipe.transform(content, mockReagents);
    expect(result).toBe(content);
  });

  it('should handle empty reagents array', () => {
    const content = '<p>Add %1.name% to solution</p>';
    const result = pipe.transform(content, []);
    expect(result).toBe(content);
  });

  it('should calculate scaled quantity when scaledQuantity is undefined', () => {
    const reagentWithoutScaledQty: StepReagent = {
      id: 4,
      step: 1,
      reagent: 40,
      reagentName: 'Enzyme',
      reagentUnit: 'µL',
      quantity: 10,
      scalable: true,
      scalableFactor: 2,
      scaledQuantity: undefined,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    };
    const content = '<p>Add %4.scaled_quantity% %4.unit% of %4.name%</p>';
    const result = pipe.transform(content, [reagentWithoutScaledQty]);
    expect(result).toBe('<p>Add 20 µL of Enzyme</p>');
  });

  it('should apply scaling factor when provided', () => {
    const content = '<p>Add %2.scaled_quantity% %2.unit% of %2.name%</p>';
    const result = pipe.transform(content, mockReagents, 2);
    expect(result).toBe('<p>Add 200 g of Salt</p>');
  });
});
