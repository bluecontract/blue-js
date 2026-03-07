import { BlueNode } from '@blue-labs/language';

import type { BlueValue } from '../types.js';
import { toBlueNode } from './node-input.js';
import { normalizePointer } from './pointer.js';
import { wrapExpression } from './expressions.js';

const RESERVED_CONTRACT_PATH_PREFIXES = [
  '/contracts/checkpoint',
  '/contracts/embedded',
  '/contracts/initialized',
  '/contracts/terminated',
] as const;

function validateAllowedPath(path: string): string {
  const normalized = normalizePointer(path, 'Patch path');
  for (const reservedPrefix of RESERVED_CONTRACT_PATH_PREFIXES) {
    if (
      normalized === reservedPrefix ||
      normalized.startsWith(`${reservedPrefix}/`)
    ) {
      throw new Error(
        `Mutating reserved processor contract path is forbidden: ${path}`,
      );
    }
  }
  return normalized;
}

function buildPatchEntry(
  op: 'replace' | 'add',
  path: string,
  value: BlueNode,
): BlueNode {
  return new BlueNode().setProperties({
    op: new BlueNode().setValue(op),
    path: new BlueNode().setValue(path),
    val: value,
  });
}

export class ChangesetBuilder {
  private readonly entries: BlueNode[] = [];

  replaceValue(path: string, value: BlueValue): this {
    const normalized = validateAllowedPath(path);
    this.entries.push(
      buildPatchEntry('replace', normalized, toBlueNode(value)),
    );
    return this;
  }

  replaceExpression(path: string, expression: string): this {
    const normalized = validateAllowedPath(path);
    this.entries.push(
      buildPatchEntry(
        'replace',
        normalized,
        new BlueNode().setValue(wrapExpression(expression)),
      ),
    );
    return this;
  }

  addValue(path: string, value: BlueValue): this {
    const normalized = validateAllowedPath(path);
    this.entries.push(buildPatchEntry('add', normalized, toBlueNode(value)));
    return this;
  }

  remove(path: string): this {
    const normalized = validateAllowedPath(path);
    this.entries.push(
      new BlueNode().setProperties({
        op: new BlueNode().setValue('remove'),
        path: new BlueNode().setValue(normalized),
      }),
    );
    return this;
  }

  build(): BlueNode[] {
    return this.entries.map((entry) => entry.clone());
  }
}
