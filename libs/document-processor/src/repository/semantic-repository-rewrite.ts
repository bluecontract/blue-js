import type { JsonValue } from '@blue-labs/shared-utils';

export function rewriteAliasMappings(
  aliases: Record<string, string>,
  idByOldId: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(aliases).map(([alias, blueId]) => [
      alias,
      rewriteBlueIdWithOptionalIndex(blueId, idByOldId),
    ]),
  );
}

export function rewriteBlueIds(
  value: JsonValue,
  idByOldId: Record<string, string>,
): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteBlueIds(item, idByOldId));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        key === 'blueId' && typeof nested === 'string'
          ? rewriteBlueIdWithOptionalIndex(nested, idByOldId)
          : rewriteBlueIds(nested as JsonValue, idByOldId),
      ]),
    );
  }

  return value;
}

export function rewriteBlueIdWithOptionalIndex(
  blueId: string,
  idByOldId: Record<string, string>,
): string {
  const exact = idByOldId[blueId];
  if (exact !== undefined) {
    return exact;
  }

  const match = /^(.*)(#\d+)$/.exec(blueId);
  if (!match) {
    return blueId;
  }

  const [, baseBlueId, indexSuffix] = match;
  return `${idByOldId[baseBlueId] ?? baseBlueId}${indexSuffix}`;
}
