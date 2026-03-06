import { BlueNode } from '@blue-labs/language';

export function ensureContracts(document: BlueNode): Record<string, BlueNode> {
  const properties = ensureProperties(document);
  const existing = properties.contracts;
  if (existing?.getProperties()) {
    return existing.getProperties() as Record<string, BlueNode>;
  }

  const contractsNode = existing ?? new BlueNode();
  const contracts = contractsNode.getProperties() ?? {};
  contractsNode.setProperties(contracts);
  properties.contracts = contractsNode;
  return contracts;
}

export function getContract(
  document: BlueNode,
  contractKey: string,
): BlueNode | null {
  return document.getContracts()?.[contractKey] ?? null;
}

export function ensureProperties(node: BlueNode): Record<string, BlueNode> {
  const existing = node.getProperties();
  if (existing) {
    return existing;
  }

  const created: Record<string, BlueNode> = {};
  node.setProperties(created);
  return created;
}
