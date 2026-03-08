import { BlueNode } from '@blue-labs/language';

import {
  applyPatchOperations,
  blueNodeToEditingJson,
  cloneEditingJson,
  editingJsonToBlueNode,
  isEditingObject,
  joinPointer,
} from '../internal/editing-json';
import type {
  DocPatchOperation,
  EditingJsonObject,
  EditingJsonValue,
} from './types';

export class DocPatch {
  private readonly original: EditingJsonValue;
  private current: EditingJsonValue;

  private constructor(original: EditingJsonValue) {
    this.original = cloneEditingJson(original);
    this.current = cloneEditingJson(original);
  }

  static from(source: BlueNode | EditingJsonValue): DocPatch {
    const original =
      source instanceof BlueNode ? blueNodeToEditingJson(source) : source;
    return new DocPatch(original);
  }

  diff(target: BlueNode | EditingJsonValue): DocPatch {
    this.current =
      target instanceof BlueNode
        ? blueNodeToEditingJson(target)
        : cloneEditingJson(target);
    return this;
  }

  add(path: string, value: EditingJsonValue): DocPatch {
    this.current = applyPatchOperations(this.current, [
      { op: 'add', path, value },
    ]);
    return this;
  }

  replace(path: string, value: EditingJsonValue): DocPatch {
    this.current = applyPatchOperations(this.current, [
      { op: 'replace', path, value },
    ]);
    return this;
  }

  remove(path: string): DocPatch {
    this.current = applyPatchOperations(this.current, [{ op: 'remove', path }]);
    return this;
  }

  build(): DocPatchOperation[] {
    return diffEditingValues(this.original, this.current);
  }

  apply(source?: BlueNode | EditingJsonValue): BlueNode {
    const base =
      source == null
        ? this.original
        : source instanceof BlueNode
          ? blueNodeToEditingJson(source)
          : source;
    const next = applyPatchOperations(base, this.build());
    return editingJsonToBlueNode(next);
  }

  toTargetJson(): EditingJsonValue {
    return cloneEditingJson(this.current);
  }
}

export function diffEditingValues(
  before: EditingJsonValue,
  after: EditingJsonValue,
): DocPatchOperation[] {
  const removals: DocPatchOperation[] = [];
  const replacements: DocPatchOperation[] = [];
  const additions: DocPatchOperation[] = [];

  collectDiff(before, after, '', removals, replacements, additions);

  return [
    ...sortOperations(removals),
    ...sortOperations(replacements),
    ...sortOperations(additions),
  ];
}

function collectDiff(
  before: EditingJsonValue,
  after: EditingJsonValue,
  path: string,
  removals: DocPatchOperation[],
  replacements: DocPatchOperation[],
  additions: DocPatchOperation[],
): void {
  if (deepEqual(before, after)) {
    return;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    replacements.push({
      op: 'replace',
      path: path || '/',
      value: cloneEditingJson(after),
    });
    return;
  }

  if (isEditingObject(before) && isEditingObject(after)) {
    if (path.length > 0 && !isContractsPath(path)) {
      replacements.push({
        op: 'replace',
        path,
        value: cloneEditingJson(after),
      });
      return;
    }

    const beforeObject = before as EditingJsonObject;
    const afterObject = after as EditingJsonObject;

    const removedKeys = Object.keys(beforeObject).filter(
      (key) => !(key in afterObject),
    );
    for (const key of removedKeys.sort()) {
      removals.push({ op: 'remove', path: joinPointer(path, key) });
    }

    const sharedKeys = Object.keys(beforeObject).filter(
      (key) => key in afterObject,
    );
    for (const key of sharedKeys.sort()) {
      collectDiff(
        beforeObject[key] as EditingJsonValue,
        afterObject[key] as EditingJsonValue,
        joinPointer(path, key),
        removals,
        replacements,
        additions,
      );
    }

    const addedKeys = Object.keys(afterObject).filter(
      (key) => !(key in beforeObject),
    );
    for (const key of addedKeys.sort()) {
      additions.push({
        op: 'add',
        path: joinPointer(path, key),
        value: cloneEditingJson(afterObject[key] as EditingJsonValue),
      });
    }
    return;
  }

  replacements.push({
    op: 'replace',
    path: path || '/',
    value: cloneEditingJson(after),
  });
}

function isContractsPath(path: string): boolean {
  return path === '/contracts' || path.startsWith('/contracts/');
}

function sortOperations(
  operations: readonly DocPatchOperation[],
): DocPatchOperation[] {
  return [...operations].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function deepEqual(left: EditingJsonValue, right: EditingJsonValue): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((value, index) =>
      deepEqual(value, right[index] as EditingJsonValue),
    );
  }

  if (isEditingObject(left) && isEditingObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every(
      (key) =>
        key in right &&
        deepEqual(
          left[key] as EditingJsonValue,
          right[key] as EditingJsonValue,
        ),
    );
  }

  return false;
}
