import { DocumentNode } from '../types';

export function buildContractEntries(
  node: DocumentNode,
): Array<[string, DocumentNode]> {
  const entries = Object.entries(node.getContracts() ?? {});

  return entries as Array<[string, DocumentNode]>;
}
