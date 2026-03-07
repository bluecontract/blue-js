import { type BlueNode } from '@blue-labs/language';
import { expect } from 'vitest';

import { createTestBlue } from './create-blue.js';

const blue = createTestBlue();

export function assertDslMatchesYaml(
  actual: BlueNode,
  expectedYaml: string,
): void {
  const expected = blue.preprocess(blue.yamlToNode(expectedYaml).clone());
  const normalizedActual = blue.preprocess(actual.clone());

  const expectedBlueId = blue.calculateBlueIdSync(expected);
  const actualBlueId = blue.calculateBlueIdSync(normalizedActual);
  const expectedJson = blue.nodeToJson(expected, 'official');
  const actualJson = blue.nodeToJson(normalizedActual, 'official');

  try {
    expect(actualJson).toEqual(expectedJson);
  } catch {
    throw new Error(
      [
        `Expected BlueId: ${expectedBlueId}`,
        `Actual BlueId: ${actualBlueId}`,
        'Expected official YAML:',
        blue.nodeToYaml(expected, 'official'),
        'Actual official YAML:',
        blue.nodeToYaml(normalizedActual, 'official'),
        'Expected official JSON:',
        JSON.stringify(expectedJson, null, 2),
        'Actual official JSON:',
        JSON.stringify(actualJson, null, 2),
      ].join('\n'),
    );
  }

  expect(actualBlueId).toBe(expectedBlueId);
}
