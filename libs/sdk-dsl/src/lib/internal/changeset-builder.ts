import { BlueNode } from '@blue-labs/language';

import type { BlueValueInput, ChangesetBuilderLike } from '../types';
import { wrapExpression } from './expression';
import { toBlueNode } from './value-to-node';

const RESERVED_PROCESSOR_PATH_PREFIXES = [
  '/contracts/checkpoint',
  '/contracts/embedded',
  '/contracts/initialized',
  '/contracts/terminated',
] as const;

export class ChangesetBuilder implements ChangesetBuilderLike {
  private readonly entries: BlueNode[] = [];

  replaceValue(path: string, value: BlueValueInput): this {
    this.entries.push(
      createPatchEntry('replace', validateAllowedPath(path), value),
    );
    return this;
  }

  replaceExpression(path: string, expression: string): this {
    this.entries.push(
      createPatchEntry(
        'replace',
        validateAllowedPath(path),
        wrapExpression(expression),
      ),
    );
    return this;
  }

  addValue(path: string, value: BlueValueInput): this {
    this.entries.push(
      createPatchEntry('add', validateAllowedPath(path), value),
    );
    return this;
  }

  remove(path: string): this {
    const entry = new BlueNode();
    entry.addProperty('op', toBlueNode('remove'));
    entry.addProperty('path', toBlueNode(validateAllowedPath(path)));
    this.entries.push(entry);
    return this;
  }

  build(): BlueNode[] {
    return this.entries.map((entry) => entry.clone());
  }
}

function createPatchEntry(
  op: 'add' | 'replace',
  path: string,
  value: BlueValueInput | string,
): BlueNode {
  const entry = new BlueNode();
  entry.addProperty('op', toBlueNode(op));
  entry.addProperty('path', toBlueNode(path));
  entry.addProperty('val', toBlueNode(value));
  return entry;
}

function validateAllowedPath(path: string): string {
  if (path == null || path.trim().length === 0) {
    throw new Error('Patch path cannot be empty');
  }

  const normalized = path.trim();
  for (const reservedPrefix of RESERVED_PROCESSOR_PATH_PREFIXES) {
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
