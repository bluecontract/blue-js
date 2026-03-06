import { BlueNode } from '@blue-labs/language';

import { INTERNAL_BLUE } from './blue';

export function mergeBlueNodes(base: BlueNode, overlay: BlueNode): BlueNode {
  const baseJson = INTERNAL_BLUE.nodeToJson(base, 'official');
  const overlayJson = INTERNAL_BLUE.nodeToJson(overlay, 'official');
  return INTERNAL_BLUE.jsonValueToNode(deepMerge(baseJson, overlayJson));
}

function deepMerge(base: unknown, overlay: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      merged[key] =
        key in base
          ? deepMerge((base as Record<string, unknown>)[key], value)
          : value;
    }
    return merged;
  }

  if (Array.isArray(overlay)) {
    return overlay.map((item) => deepMerge(undefined, item));
  }

  return overlay;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
