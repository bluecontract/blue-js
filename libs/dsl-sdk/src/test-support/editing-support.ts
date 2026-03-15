import { isDeepStrictEqual } from 'node:util';
import { BlueNode } from '@blue-labs/language';
import { createTestBlue } from '../test-harness/runtime.js';

const blue = createTestBlue();

export function assertCanonicalNodeEquals(
  actualNode: BlueNode,
  expectedNode: BlueNode,
): void {
  const actual = blue.preprocess(actualNode.clone());
  const expected = blue.preprocess(expectedNode.clone());

  const actualBlueId = blue.calculateBlueIdSync(actual);
  const expectedBlueId = blue.calculateBlueIdSync(expected);
  const actualJson = blue.nodeToJson(actual, 'official');
  const expectedJson = blue.nodeToJson(expected, 'official');

  if (
    actualBlueId !== expectedBlueId ||
    !isDeepStrictEqual(actualJson, expectedJson)
  ) {
    throw new Error(
      [
        'Canonical document mismatch.',
        `Expected BlueId: ${expectedBlueId}`,
        `Actual BlueId:   ${actualBlueId}`,
        '',
        'Expected JSON:',
        JSON.stringify(expectedJson, null, 2),
        '',
        'Actual JSON:',
        JSON.stringify(actualJson, null, 2),
      ].join('\n'),
    );
  }
}

export function putDocumentSection(
  document: BlueNode,
  options: {
    readonly key: string;
    readonly title: string;
    readonly summary?: string;
    readonly relatedFields?: readonly string[];
    readonly relatedContracts?: readonly string[];
  },
): void {
  const section: Record<string, unknown> = {
    type: 'Conversation/Document Section',
    title: options.title,
    relatedFields: [...(options.relatedFields ?? [])],
    relatedContracts: [...(options.relatedContracts ?? [])],
  };

  if (options.summary) {
    section.summary = options.summary;
  }

  document.addContract(options.key, blue.jsonValueToNode(section));
}
