import { BlueNumbers } from '../BlueNumbers';

describe('BlueNumbers', () => {
  it('uses exact binary64 rational arithmetic for Double multipleOf', () => {
    expect(BlueNumbers.isExactBinary64Multiple(0.3, 0.1)).toBe(false);
    expect(BlueNumbers.isExactBinary64Multiple(1.5, 0.5)).toBe(true);
  });
});
