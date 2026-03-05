import type { SectionConfig } from '../types.js';

export class SectionContext {
  public readonly relatedFields = new Set<string>();
  public readonly relatedContracts = new Set<string>();

  public constructor(
    public readonly key: string,
    public readonly config: SectionConfig,
  ) {}

  public trackField(pointer: string): void {
    this.relatedFields.add(pointer);
  }

  public trackContract(key: string): void {
    if (key !== this.key) {
      this.relatedContracts.add(key);
    }
  }
}
