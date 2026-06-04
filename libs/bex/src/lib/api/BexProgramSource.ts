import type { BexReadableNode } from '../value/BexValues';

export type BexProgramInputKind = 'source' | 'resolved';
export type BexProgramNode = BexReadableNode;

export interface BexProgramSourceOptions {
  readonly inputKind?: BexProgramInputKind;
}

export class BexProgramSource {
  private constructor(
    public readonly node: BexProgramNode,
    public readonly definitionNode?: BexProgramNode,
    public readonly entry?: string,
    public readonly inputKind: BexProgramInputKind = 'source',
  ) {}

  public static inline(
    node: BexProgramNode,
    options: BexProgramSourceOptions = {},
  ): BexProgramSource {
    return new BexProgramSource(
      node,
      undefined,
      undefined,
      options.inputKind ?? 'source',
    );
  }

  public static withDefinition(
    node: BexProgramNode,
    definitionNode: BexProgramNode,
    entry?: string,
    options: BexProgramSourceOptions = {},
  ): BexProgramSource {
    return new BexProgramSource(
      node,
      definitionNode,
      entry,
      options.inputKind ?? 'source',
    );
  }
}
