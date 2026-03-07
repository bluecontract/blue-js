import { isDeepStrictEqual } from 'node:util';

import { BlueNode } from '@blue-labs/language';

import { createParityBlue } from './processor-harness';

export type CanonicalDocumentInput = BlueNode | Record<string, unknown>;

const blue = createParityBlue();

export function canonicalDocToNode(input: CanonicalDocumentInput): BlueNode {
  return input instanceof BlueNode
    ? input.clone()
    : blue.jsonValueToNode(input);
}

export function assertCanonicalDocMatchesDsl(
  canonicalDocument: CanonicalDocumentInput,
  dslDocument: BlueNode,
): void {
  assertCanonicalNodeMatchesDsl(
    canonicalDocToNode(canonicalDocument),
    dslDocument,
  );
}

export function assertCanonicalNodeMatchesDsl(
  canonicalNode: BlueNode,
  dslNode: BlueNode,
): void {
  const canonical = blue.preprocess(canonicalNode.clone());
  const actual = blue.preprocess(dslNode.clone());

  const canonicalBlueId = blue.calculateBlueIdSync(canonical);
  const actualBlueId = blue.calculateBlueIdSync(actual);
  const canonicalJson = blue.nodeToJson(canonical, 'official');
  const actualJson = blue.nodeToJson(actual, 'official');

  if (
    canonicalBlueId !== actualBlueId ||
    !isDeepStrictEqual(canonicalJson, actualJson)
  ) {
    throw new Error(
      [
        'Canonical scenario mismatch.',
        `Canonical BlueId: ${canonicalBlueId}`,
        `DSL BlueId:       ${actualBlueId}`,
        '',
        'Canonical YAML:',
        blue.nodeToYaml(canonical, 'official'),
        '',
        'DSL YAML:',
        blue.nodeToYaml(actual, 'official'),
        '',
        'Canonical JSON:',
        JSON.stringify(canonicalJson, null, 2),
        '',
        'DSL JSON:',
        JSON.stringify(actualJson, null, 2),
      ].join('\n'),
    );
  }
}

export function assertCanonicalEventListsMatchDsl(
  canonicalEvents: readonly BlueNode[],
  dslEvents: readonly BlueNode[],
): void {
  if (canonicalEvents.length !== dslEvents.length) {
    throw new Error(
      `Canonical event count ${canonicalEvents.length} does not match DSL event count ${dslEvents.length}.`,
    );
  }

  for (const [index, canonicalEvent] of canonicalEvents.entries()) {
    const dslEvent = dslEvents[index];
    if (!dslEvent) {
      throw new Error(`Missing DSL event at index ${index}.`);
    }

    assertCanonicalNodeMatchesDsl(canonicalEvent, dslEvent);
  }
}
