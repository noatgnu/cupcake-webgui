import { StepTemplatePipe } from './step-template-pipe';
import type { StepReagent } from '@noatgnu/cupcake-red-velvet';

describe('StepTemplatePipe', () => {
  let pipe: StepTemplatePipe;

  const mockReagents: StepReagent[] = [
    {
      id: 1,
      step: 1,
      reagent: { id: 10, name: 'Water', unit: 'mL', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
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
      reagent: { id: 20, name: 'Salt', unit: 'g', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      reagentName: 'Salt',
      reagentUnit: 'g',
      quantity: 50,
      scalable: true,
      scalableFactor: 2,
      scaledQuantity: 100,
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

  it('should return empty string for null content', () => {
    expect(pipe.transform(null, [])).toBe('');
  });

  it('should return empty string for undefined content', () => {
    expect(pipe.transform(undefined, [])).toBe('');
  });

  it('should return original content when no reagents provided', () => {
    const content = '<p>Add template to solution</p>';
    expect(pipe.transform(content, [])).toBe(content);
  });

  it('should replace reagent name template with span element', () => {
    const result = pipe.transform('<p>%1.name%</p>', mockReagents);
    expect(result).toContain('Water');
    expect(result).toContain('template-value-name');
  });

  it('should replace reagent quantity template with span element', () => {
    const result = pipe.transform('<p>%1.quantity%</p>', mockReagents);
    expect(result).toContain('100');
    expect(result).toContain('template-value');
  });

  it('should replace reagent unit template with span element', () => {
    const result = pipe.transform('<p>%1.unit%</p>', mockReagents);
    expect(result).toContain('mL');
    expect(result).toContain('template-value-unit');
  });

  it('should replace scaled_quantity template with span element', () => {
    const result = pipe.transform('<p>%2.scaled_quantity%</p>', mockReagents);
    expect(result).toContain('100');
    expect(result).toContain('template-value-scaled');
  });

  it('should handle multiple templates in same content', () => {
    const result = pipe.transform('<p>%1.name% and %2.name%</p>', mockReagents);
    expect(result).toContain('Water');
    expect(result).toContain('Salt');
  });

  it('should not replace non-existent reagent templates', () => {
    const content = '<p>%999.name%</p>';
    expect(pipe.transform(content, mockReagents)).toBe(content);
  });

  it('should apply scaling factor to scaled_quantity', () => {
    const result = pipe.transform('<p>%2.scaled_quantity%</p>', mockReagents, 2);
    expect(result).toContain('200');
  });

  it('should calculate scaled quantity when scaledQuantity is undefined', () => {
    const reagent: StepReagent = {
      id: 3,
      step: 1,
      reagent: { id: 30, name: 'Enzyme', unit: 'µL', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      reagentName: 'Enzyme',
      reagentUnit: 'µL',
      quantity: 10,
      scalable: true,
      scalableFactor: 2,
      scaledQuantity: undefined,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    };
    const result = pipe.transform('<p>%3.scaled_quantity%</p>', [reagent]);
    expect(result).toContain('20');
  });

  it('should use empty string for reagent without unit', () => {
    const reagent: StepReagent = {
      id: 4,
      step: 1,
      reagent: { id: 40, name: 'Buffer', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      reagentName: 'Buffer',
      reagentUnit: undefined,
      quantity: 25,
      scalable: false,
      scalableFactor: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    };
    const result = pipe.transform('<p>%4.unit%</p>', [reagent]);
    expect(result).not.toContain('%4.unit%');
  });

  it('should not modify content without templates', () => {
    const content = '<p>This is a regular step description without templates.</p>';
    expect(pipe.transform(content, mockReagents)).toBe(content);
  });
});
