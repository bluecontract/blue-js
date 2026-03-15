import { Blue, BlueNode } from '@blue-labs/language';
import { repository } from '@blue-repository/types';
import type { JsonObject } from './types.js';

export const sdkBlue = new Blue({
  repositories: [repository],
});

export interface DocumentBuilderLike {
  buildDocument(): BlueNode;
}

export function fromJsonDocument(document: JsonObject): BlueNode {
  return sdkBlue.jsonValueToNode(document);
}

export function toOfficialJson(
  input: BlueNode | DocumentBuilderLike | JsonObject,
): JsonObject {
  if (isJsonObjectInput(input)) {
    return structuredClone(input);
  }
  const inlineTypesNode = sdkBlue.restoreInlineTypes(resolveNode(input));
  return sdkBlue.nodeToJson(inlineTypesNode, 'simple') as JsonObject;
}

export function toOfficialYaml(
  input: BlueNode | DocumentBuilderLike | JsonObject,
): string {
  const inlineTypesNode = sdkBlue.restoreInlineTypes(
    isJsonObjectInput(input) ? fromJsonDocument(input) : resolveNode(input),
  );
  return sdkBlue.nodeToYaml(inlineTypesNode, 'simple');
}

export function ensureExpression(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('${') && trimmed.endsWith('}')) {
    return trimmed;
  }
  return `\${${trimmed}}`;
}

function resolveNode(input: BlueNode | DocumentBuilderLike): BlueNode {
  return isBuilderLike(input) ? input.buildDocument() : input;
}

function isBuilderLike(
  value: BlueNode | DocumentBuilderLike,
): value is DocumentBuilderLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DocumentBuilderLike).buildDocument === 'function'
  );
}

function isJsonObjectInput(
  value: BlueNode | DocumentBuilderLike | JsonObject,
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof BlueNode) &&
    typeof (value as DocumentBuilderLike).buildDocument !== 'function'
  );
}
