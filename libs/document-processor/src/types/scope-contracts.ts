import type { BlueNode } from '@blue-labs/language';

export interface ScopeContractEntry {
  readonly node: BlueNode;
  readonly nodeTypeBlueId: string;
}

export type ScopeContractsIndex = ReadonlyMap<string, ScopeContractEntry>;
