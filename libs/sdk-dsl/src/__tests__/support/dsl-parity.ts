import { type BlueNode } from '@blue-labs/language';
import { expect } from 'vitest';

import { createTestBlue } from './create-blue.js';

const blue = createTestBlue();

function assertNormalizedNodesMatch(
  actual: BlueNode,
  expected: BlueNode,
): void {
  const normalizedExpected = blue.preprocess(expected.clone());
  const normalizedActual = blue.preprocess(actual.clone());

  const expectedBlueId = blue.calculateBlueIdSync(normalizedExpected);
  const actualBlueId = blue.calculateBlueIdSync(normalizedActual);
  const expectedJson = blue.nodeToJson(normalizedExpected, 'official');
  const actualJson = blue.nodeToJson(normalizedActual, 'official');

  try {
    expect(actualJson).toEqual(expectedJson);
  } catch {
    throw new Error(
      [
        `Expected BlueId: ${expectedBlueId}`,
        `Actual BlueId: ${actualBlueId}`,
        'Expected official YAML:',
        blue.nodeToYaml(normalizedExpected, 'official'),
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

export function assertDslMatchesYaml(
  actual: BlueNode,
  expectedYaml: string,
): void {
  assertNormalizedNodesMatch(actual, blue.yamlToNode(expectedYaml));
}

export function assertDslMatchesNode(
  actual: BlueNode,
  expected: BlueNode,
): void {
  assertNormalizedNodesMatch(actual, expected);
}
