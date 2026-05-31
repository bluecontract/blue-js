import assert from 'node:assert/strict';

export function expect(actual: unknown, message?: string): ConformanceExpect {
  return new ConformanceExpect(actual, message);
}

class ConformanceExpect {
  readonly not: NegatedConformanceExpect;

  constructor(
    private readonly actual: unknown,
    private readonly message?: string,
  ) {
    this.not = new NegatedConformanceExpect(actual, message);
  }

  toBe(expected: unknown): void {
    assert.equal(this.actual, expected, this.message);
  }

  toEqual(expected: unknown): void {
    assert.deepEqual(this.actual, expected, this.message);
  }
}

class NegatedConformanceExpect {
  constructor(
    private readonly actual: unknown,
    private readonly message?: string,
  ) {}

  toBe(expected: unknown): void {
    assert.notEqual(this.actual, expected, this.message);
  }
}
