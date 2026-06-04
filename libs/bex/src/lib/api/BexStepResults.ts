import { BexValue, BexValues } from '../value/BexValues';

export class BexStepResults {
  private readonly values = new Map<string, BexValue>();

  public static fromSimple(
    values: Record<string, unknown> = {},
  ): BexStepResults {
    const results = new BexStepResults();
    for (const [key, value] of Object.entries(values)) {
      results.put(key, BexValues.fromSimple(value));
    }
    return results;
  }

  public put(key: string, value: BexValue): void {
    this.values.set(key, value);
  }

  public get(key: string): BexValue {
    return this.values.get(key) ?? BexValues.undefined();
  }

  public toSimple(): Record<string, unknown> {
    return Object.fromEntries(
      [...this.values.entries()].map(([key, value]) => [key, value.toSimple()]),
    );
  }

  public asValue(): BexValue {
    return BexValues.fromSimple(this.toSimple());
  }
}
