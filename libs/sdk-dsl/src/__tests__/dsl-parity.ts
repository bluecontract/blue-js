import { isDeepStrictEqual } from 'node:util';

import { BlueNode } from '@blue-labs/language';

import { createBlue } from './processor-harness';

const blue = createBlue();

export function assertDslMatchesYaml(fromDsl: BlueNode, yaml: string): void {
  const expected = blue.preprocess(blue.yamlToNode(yaml).clone());
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
