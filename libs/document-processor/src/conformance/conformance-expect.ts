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

  toContain(expected: unknown): void {
    if (typeof this.actual === 'string') {
      assert.ok(this.actual.includes(String(expected)), this.message);
      return;
    }
    if (Array.isArray(this.actual)) {
      assert.ok(this.actual.includes(expected), this.message);
      return;
    }
    throw new assert.AssertionError({
      message: this.message ?? 'Expected value to support includes().',
      actual: this.actual,
      expected,
      operator: 'includes',
    });
  }

  toBeInstanceOf(expected: abstract new (...args: never[]) => unknown): void {
    assert.ok(this.actual instanceof expected, this.message);
  }

  toBeNull(): void {
    assert.equal(this.actual, null, this.message);
  }

  toBeDefined(): void {
    assert.notEqual(this.actual, undefined, this.message);
  }

  toHaveLength(expected: number): void {
    const length =
      this.actual instanceof Set
        ? this.actual.size
        : (this.actual as { length?: number }).length;
    assert.equal(length, expected, this.message);
  }

  toBeGreaterThan(expected: number): void {
    assert.ok(Number(this.actual) > expected, this.message);
  }

  toBeGreaterThanOrEqual(expected: number): void {
    assert.ok(Number(this.actual) >= expected, this.message);
  }

  toThrowError(expected?: RegExp): void {
    assert.equal(typeof this.actual, 'function', this.message);
    if (expected === undefined) {
      assert.throws(this.actual as () => unknown);
      return;
    }
    assert.throws(this.actual as () => unknown, expected, this.message);
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

  toEqual(expected: unknown): void {
    assert.notDeepEqual(this.actual, expected, this.message);
  }

  toHaveBeenCalled(): never {
    throw new Error(
      'Call-spy assertions are not available in conformance modules.',
    );
  }
}
