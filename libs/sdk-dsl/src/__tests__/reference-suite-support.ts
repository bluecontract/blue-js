import { isDeepStrictEqual } from 'node:util';

import { BlueNode } from '@blue-labs/language';

import { createParityBlue } from './processor-harness';

export type ReferenceDocumentInput = BlueNode | Record<string, unknown>;

const blue = createParityBlue();

export function referenceDocToNode(input: ReferenceDocumentInput): BlueNode {
  return input instanceof BlueNode
    ? input.clone()
    : blue.jsonValueToNode(input);
}

export function assertReferenceDocMatchesDsl(
  referenceDocument: ReferenceDocumentInput,
  dslDocument: BlueNode,
): void {
  assertReferenceNodeMatchesDsl(
    referenceDocToNode(referenceDocument),
    dslDocument,
  );
}

export function assertReferenceNodeMatchesDsl(
  referenceNode: BlueNode,
  dslNode: BlueNode,
): void {
  const reference = blue.preprocess(referenceNode.clone());
  const actual = blue.preprocess(dslNode.clone());

  const referenceBlueId = blue.calculateBlueIdSync(reference);
  const actualBlueId = blue.calculateBlueIdSync(actual);
  const referenceJson = blue.nodeToJson(reference, 'official');
  const actualJson = blue.nodeToJson(actual, 'official');

  if (
    referenceBlueId !== actualBlueId ||
    !isDeepStrictEqual(referenceJson, actualJson)
  ) {
    throw new Error(
      [
        'Reference suite mismatch.',
        `Reference BlueId: ${referenceBlueId}`,
        `DSL BlueId:       ${actualBlueId}`,
        '',
        'Reference YAML:',
        blue.nodeToYaml(reference, 'official'),
        '',
        'DSL YAML:',
        blue.nodeToYaml(actual, 'official'),
        '',
        'Reference JSON:',
        JSON.stringify(referenceJson, null, 2),
        '',
        'DSL JSON:',
        JSON.stringify(actualJson, null, 2),
      ].join('\n'),
    );
  }
}

export function assertReferenceEventListsMatchDsl(
  referenceEvents: readonly BlueNode[],
  dslEvents: readonly BlueNode[],
): void {
  if (referenceEvents.length !== dslEvents.length) {
    throw new Error(
      `Reference event count ${referenceEvents.length} does not match DSL event count ${dslEvents.length}.`,
    );
  }

  for (const [index, referenceEvent] of referenceEvents.entries()) {
    const dslEvent = dslEvents[index];
    if (!dslEvent) {
      throw new Error(`Missing DSL event at index ${index}.`);
    }

    assertReferenceNodeMatchesDsl(referenceEvent, dslEvent);
  }
}
