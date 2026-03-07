import { isDeepStrictEqual } from 'node:util';

import { BlueNode } from '@blue-labs/language';

import { createParityBlue } from './processor-harness';

const blue = createParityBlue();

export function assertDslMatchesYaml(fromDsl: BlueNode, yaml: string): void {
  assertDslMatchesNode(fromDsl, blue.yamlToNode(yaml));
}

export function assertDslMatchesNode(
  fromDsl: BlueNode,
  expectedNode: BlueNode,
): void {
  const expected = blue.preprocess(expectedNode.clone());
  const actual = blue.preprocess(fromDsl.clone());

  const expectedBlueId = blue.calculateBlueIdSync(expected);
  const actualBlueId = blue.calculateBlueIdSync(actual);
  const expectedJson = blue.nodeToJson(expected, 'official');
  const actualJson = blue.nodeToJson(actual, 'official');

  if (
    actualBlueId !== expectedBlueId ||
    !isDeepStrictEqual(actualJson, expectedJson)
  ) {
    throw new Error(
      [
        'DSL parity mismatch.',
        `Expected BlueId: ${expectedBlueId}`,
        `Actual BlueId:   ${actualBlueId}`,
        '',
        'Expected YAML:',
        blue.nodeToYaml(expected, 'official'),
        '',
        'Actual YAML:',
        blue.nodeToYaml(actual, 'official'),
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
