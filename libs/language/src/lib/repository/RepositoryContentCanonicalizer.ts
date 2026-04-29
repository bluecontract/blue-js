import type { JsonBlueValue } from '../../schema';
import { CyclicSetIdentityService } from '../identity/CyclicSetIdentityService';
import { BlueNode, NodeDeserializer } from '../model';
import { NodeToMapListOrValue } from '../utils';

export function canonicalizeRepositoryContent(
  content: JsonBlueValue,
): JsonBlueValue {
  if (!Array.isArray(content)) {
    return content;
  }

  return canonicalizeRepositoryDocumentList(content);
}

export function canonicalizeRepositoryDocumentList(
  content: JsonBlueValue[],
): JsonBlueValue[] {
  const nodes = content.map((item) => NodeDeserializer.deserialize(item));

  if (!CyclicSetIdentityService.hasIndexedThisReference(nodes)) {
    return content;
  }

  return canonicalizeRepositoryNodeList(nodes);
}

function canonicalizeRepositoryNodeList(nodes: BlueNode[]): JsonBlueValue[] {
  const cyclicSet = new CyclicSetIdentityService().calculate(nodes);
  return cyclicSet.nodes.map((node) => NodeToMapListOrValue.get(node));
}
