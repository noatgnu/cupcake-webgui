import { DurationFormatPipe } from './duration-format-pipe';

describe('DurationFormatPipe', () => {
  let pipe: DurationFormatPipe;

  beforeEach(() => {
    pipe = new DurationFormatPipe();
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should format 0 seconds as "0s"', () => {
    expect(pipe.transform(0)).toBe('0s');
  });

  it('should format null as "0s"', () => {
    expect(pipe.transform(null)).toBe('0s');
  });

  it('should format undefined as "0s"', () => {
    expect(pipe.transform(undefined)).toBe('0s');
  });

  it('should format only seconds', () => {
    expect(pipe.transform(45)).toBe('45s');
  });

  it('should format minutes and seconds', () => {
    expect(pipe.transform(90)).toBe('1m 30s');
  });

  it('should format only minutes', () => {
    expect(pipe.transform(120)).toBe('2m');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(pipe.transform(3661)).toBe('1h 1m 1s');
  });

  it('should format only hours', () => {
    expect(pipe.transform(7200)).toBe('2h');
  });

  it('should format days, hours, minutes, and seconds', () => {
    expect(pipe.transform(90061)).toBe('1d 1h 1m 1s');
  });

  it('should format only days', () => {
    expect(pipe.transform(86400)).toBe('1d');
  });

  it('should format complex duration', () => {
    expect(pipe.transform(183723)).toBe('2d 3h 2m 3s');
  });

  it('should skip zero values in middle', () => {
    expect(pipe.transform(86401)).toBe('1d 1s');
  });
});
