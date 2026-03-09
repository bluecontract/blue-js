import { BlueNode } from '@blue-labs/language';

import type { JsonObject } from './types';
import { nodeToAliasJson } from './alias-json';
import { INTERNAL_BLUE } from './internal/blue';

export interface DocumentBuilderLike {
  buildDocument(): BlueNode;
}

export function toOfficialJson(
  input: BlueNode | DocumentBuilderLike,
): JsonObject {
  return nodeToAliasJson(resolveNode(input)) as JsonObject;
}

export function toOfficialYaml(input: BlueNode | DocumentBuilderLike): string {
  const restored = INTERNAL_BLUE.restoreInlineTypes(resolveNode(input).clone());
  return INTERNAL_BLUE.nodeToYaml(restored, 'simple');
}

function resolveNode(input: BlueNode | DocumentBuilderLike): BlueNode {
  return isBuilderLike(input) ? input.buildDocument() : input;
}

function isBuilderLike(
  value: BlueNode | DocumentBuilderLike,
): value is DocumentBuilderLike {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof (value as DocumentBuilderLike).buildDocument === 'function'
  );
}
