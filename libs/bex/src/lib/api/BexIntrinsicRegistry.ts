import { BexException } from '../BexException';
import { BexValue, BexValues } from '../value/BexValues';

export class BexIntrinsicInvocation {
  constructor(
    public readonly blueId: string,
    public readonly type: BexValue,
    private readonly evaluatedFields: ReadonlyMap<string, BexValue>,
    private readonly gasCharger: (amount: number) => void,
    private readonly gasUsedSupplier: () => number,
  ) {}

  public fields(): ReadonlyMap<string, BexValue> {
    return this.evaluatedFields;
  }

  public field(name: string): BexValue {
    return this.evaluatedFields.get(name) ?? BexValues.undefined();
  }

  public chargeGas(amount: number): void {
    this.gasCharger(amount);
  }

  public gasUsed(): number {
    return this.gasUsedSupplier();
  }
}

export type BexIntrinsicProcessor = (
  invocation: BexIntrinsicInvocation,
) => BexValue | undefined | null;

export class BexIntrinsicRegistry {
  private static readonly EMPTY = new BexIntrinsicRegistry(new Map());

  constructor(
    private readonly processors: ReadonlyMap<string, BexIntrinsicProcessor>,
  ) {}

  public static empty(): BexIntrinsicRegistry {
    return this.EMPTY;
  }

  public static builder(): BexIntrinsicRegistryBuilder {
    return new BexIntrinsicRegistryBuilder();
  }

  public with(
    blueId: string,
    processor: BexIntrinsicProcessor,
  ): BexIntrinsicRegistry {
    return BexIntrinsicRegistry.builder()
      .registerAll(this.processors)
      .register(blueId, processor)
      .build();
  }

  public supports(blueId: string): boolean {
    return this.processors.has(blueId);
  }

  public supportedBlueIds(): readonly string[] {
    return [...this.processors.keys()];
  }

  public invoke(
    blueId: string,
    type: BexValue,
    fields: ReadonlyMap<string, BexValue>,
    gasCharger: (amount: number) => void,
    gasUsedSupplier: () => number,
  ): BexValue {
    const processor = this.processors.get(blueId);
    if (processor === undefined) {
      throw new BexException(`Unsupported intrinsic BlueId: ${blueId}`);
    }
    const value = processor(
      new BexIntrinsicInvocation(
        blueId,
        type,
        fields,
        gasCharger,
        gasUsedSupplier,
      ),
    );
    return value ?? BexValues.undefined();
  }
}

export class BexIntrinsicRegistryBuilder {
  private readonly processors = new Map<string, BexIntrinsicProcessor>();

  public register(
    blueId: string,
    processor: BexIntrinsicProcessor,
  ): BexIntrinsicRegistryBuilder {
    const trimmed = blueId.trim();
    if (trimmed.length === 0) {
      throw new Error('intrinsic blueId is required');
    }
    this.processors.set(trimmed, processor);
    return this;
  }

  public registerAll(
    processors: ReadonlyMap<string, BexIntrinsicProcessor>,
  ): BexIntrinsicRegistryBuilder {
    for (const [blueId, processor] of processors) {
      this.register(blueId, processor);
    }
    return this;
  }

  public build(): BexIntrinsicRegistry {
    if (this.processors.size === 0) {
      return BexIntrinsicRegistry.empty();
    }
    return new BexIntrinsicRegistry(this.processors);
  }
}
