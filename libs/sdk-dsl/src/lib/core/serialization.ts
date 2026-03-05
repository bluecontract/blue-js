import { Blue, type BlueNode } from '@blue-labs/language';
import { repository } from '@blue-repository/types';
import type { JsonObject } from './types.js';

export const sdkBlue = new Blue({
  repositories: [repository],
});

export function fromJsonDocument(document: JsonObject): BlueNode {
  return sdkBlue.jsonValueToNode(document);
}

export function toOfficialJson(node: BlueNode): JsonObject {
  const inlineTypesNode = sdkBlue.restoreInlineTypes(node);
  return sdkBlue.nodeToJson(inlineTypesNode, 'simple') as JsonObject;
}

export function toOfficialYaml(node: BlueNode): string {
  const inlineTypesNode = sdkBlue.restoreInlineTypes(node);
  return sdkBlue.nodeToYaml(inlineTypesNode, 'simple');
}

export function ensureExpression(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('${') && trimmed.endsWith('}')) {
    return trimmed;
  }
  return `\${${trimmed}}`;
}
