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

  const expectedJson = blue.nodeToJson(expected, 'simple');
  const actualJson = blue.nodeToJson(normalizedActual, 'simple');
  const expectedBlueId = blue.calculateBlueIdSync(expected);
  const actualBlueId = blue.calculateBlueIdSync(normalizedActual);

  try {
    expect(actualJson).toEqual(expectedJson);
  } catch {
    throw new Error(
      [
        `Expected BlueId: ${expectedBlueId}`,
        `Actual BlueId: ${actualBlueId}`,
        'Expected YAML:',
        blue.nodeToYaml(expected, 'simple'),
        'Actual YAML:',
        blue.nodeToYaml(normalizedActual, 'simple'),
        'Expected JSON:',
        JSON.stringify(expectedJson, null, 2),
        'Actual JSON:',
        JSON.stringify(actualJson, null, 2),
      ].join('\n'),
    );
  }

  expect(actualBlueId).toBe(expectedBlueId);
}
