import { BlueNode } from '@blue-labs/language';

import type { JsonPatch } from '../../model/shared/json-patch.js';
import { PatchEngine } from '../../runtime/patch-engine.js';
import {
  ProcessorErrorCategory,
  type ProcessorErrorCategory as ProcessorErrorCategoryValue,
} from '../../types/document-processing-result.js';
import { ProcessorErrors } from '../../types/errors.js';
import {
  normalizePointer,
  normalizeScope,
  resolvePointer,
} from '../../util/pointer-utils.js';
import { ProcessorFatalError } from '../processor-fatal-error.js';
import {
  descendantOrEqual,
  metadataWriteNodePath,
  parentPointer,
  splitPointer,
  strictlyInside,
} from './type-generalization-pointer-utils.js';
import {
  EmptyTypeGraphProvider,
  type TypeGraphProvider,
} from './type-graph-provider.js';
import { TypeGeneralizationPolicyResolver } from './type-generalization-policy-resolver.js';
import { TypeValidationMemo } from './type-validation-memo.js';

export interface TypeGeneralizationPlan {
  readonly generatedPatches: readonly JsonPatch[];
}

export class TypeGeneralizationPlanner {
  private readonly policyResolver = new TypeGeneralizationPolicyResolver(
    nodeAt,
  );

  constructor(
    private readonly typeGraph: TypeGraphProvider = new EmptyTypeGraphProvider(),
    private readonly validationMemo = new TypeValidationMemo(),
  ) {}

  planPatch(
    scopePath: string,
    document: BlueNode,
    patch: JsonPatch,
  ): TypeGeneralizationPlan {
    const root = document.clone();
    new PatchEngine(root).applyPatch(scopePath, patch);
    this.validationMemo.invalidateForMutation(normalizePointer(patch.path));

    const generatedPaths: string[] = [];
    this.generalizeChangedPath(
      root,
      normalizePointer(patch.path),
      normalizeScope(scopePath),
      generatedPaths,
      this.validationMemo,
    );

    if (generatedPaths.length === 0) {
      return { generatedPatches: [] };
    }

    this.enforceNoInvalidAncestorsAcrossBoundary(
      root,
      scopePath,
      this.validationMemo,
    );
    this.enforceScopeBoundary(scopePath, generatedPaths);
    this.enforceGeneralizationPolicy(root, scopePath, generatedPaths);

    return {
      generatedPatches: generatedPaths.map((pathValue) => ({
        op: nodeAt(document, pathValue) == null ? 'ADD' : 'REPLACE',
        path: pathValue,
        val: requireNodeAt(root, pathValue).clone(),
      })),
    };
  }

  private generalizeChangedPath(
    root: BlueNode,
    changedPath: string,
    originScope: string,
    generatedPaths: string[],
    validationMemo: TypeValidationMemo,
  ): void {
    if (this.crossesEmbeddedScope(root, changedPath, originScope)) {
      throwGeneralizationFailure(
        ProcessorErrorCategory.BoundaryViolation,
        'GeneralizationRejected: embedded child patch cannot generalize parent scope',
      );
    }

    let current = deepestExistingPointer(root, changedPath);
    while (current != null) {
      if (!descendantOrEqual(current, originScope)) {
        return;
      }
      const node = nodeAt(root, current);
      const currentType = typeBlueId(node);
      if (
        currentType &&
        node &&
        !this.typeGraph.isValidForType(
          root,
          current,
          node,
          currentType,
          validationMemo,
          changedPath,
        )
      ) {
        if (this.isEmbeddedScope(root, originScope)) {
          throwGeneralizationFailure(
            ProcessorErrorCategory.BoundaryViolation,
            'BoundaryViolation: embedded child patch cannot generalize type metadata',
          );
        }
        const replacement = this.nearestValidType(
          root,
          current,
          node,
          currentType,
          validationMemo,
          changedPath,
        );
        const generatedPath = applyTypeWrite(
          root,
          current,
          replacement,
          generatedPaths,
        );
        if (generatedPath) {
          validationMemo.invalidateForMutation(generatedPath);
        }
      }
      if (current === '/') {
        return;
      }
      current = parentPointer(current);
    }
  }

  private isEmbeddedScope(root: BlueNode, originScope: string): boolean {
    const normalizedOrigin = normalizeScope(originScope);
    if (normalizedOrigin === '/') {
      return false;
    }

    let parent = parentPointer(normalizedOrigin);
    while (parent != null) {
      const embeddedPaths = nodeAt(
        root,
        parent === '/'
          ? '/contracts/embedded/paths'
          : `${parent}/contracts/embedded/paths`,
      );
      for (const item of embeddedPaths?.getItems() ?? []) {
        const value = item.getValue();
        if (value == null) {
          continue;
        }
        if (resolvePointer(parent, String(value)) === normalizedOrigin) {
          return true;
        }
      }
      if (parent === '/') {
        return false;
      }
      parent = parentPointer(parent);
    }
    return false;
  }

  private crossesEmbeddedScope(
    root: BlueNode,
    pathValue: string,
    originScope: string,
  ): boolean {
    const embeddedPaths = nodeAt(root, '/contracts/embedded/paths');
    for (const item of embeddedPaths?.getItems() ?? []) {
      const value = item.getValue();
      if (value == null) {
        continue;
      }
      const embedded = normalizePointer(String(value));
      if (
        strictlyInside(pathValue, embedded) &&
        !descendantOrEqual(originScope, embedded)
      ) {
        return true;
      }
    }
    return false;
  }

  private nearestValidType(
    root: BlueNode,
    pointer: string,
    node: BlueNode,
    currentType: string,
    validationMemo: TypeValidationMemo,
    focusPointer: string,
  ): string {
    let candidate = this.typeGraph.parentType(currentType);
    while (candidate != null) {
      if (
        this.typeGraph.isValidForType(
          root,
          pointer,
          node,
          candidate,
          validationMemo,
          focusPointer,
        )
      ) {
        return candidate;
      }
      candidate = this.typeGraph.parentType(candidate);
    }

    throwGeneralizationFailure(
      ProcessorErrorCategory.GeneralizationNoValidType,
      'Node cannot be generalized to a conforming type',
    );
  }

  private enforceScopeBoundary(
    originScope: string,
    generatedPaths: readonly string[],
  ): void {
    const normalizedOrigin = normalizeScope(originScope);
    if (normalizedOrigin === '/') {
      return;
    }
    for (const generatedPath of generatedPaths) {
      const write = metadataWriteNodePath(generatedPath);
      if (write && !descendantOrEqual(write, normalizedOrigin)) {
        throwGeneralizationFailure(
          ProcessorErrorCategory.BoundaryViolation,
          'BoundaryViolation: embedded child patch cannot generalize parent scope',
        );
      }
    }
  }

  private enforceNoInvalidAncestorsAcrossBoundary(
    root: BlueNode,
    originScope: string,
    validationMemo: TypeValidationMemo,
  ): void {
    const normalizedOrigin = normalizeScope(originScope);
    if (normalizedOrigin === '/') {
      return;
    }

    let current = parentPointer(normalizedOrigin);
    while (current != null) {
      const node = nodeAt(root, current);
      const currentType = typeBlueId(node);
      if (
        currentType &&
        node &&
        !this.typeGraph.isValidForType(
          root,
          current,
          node,
          currentType,
          validationMemo,
          normalizedOrigin,
        )
      ) {
        throwGeneralizationFailure(
          ProcessorErrorCategory.BoundaryViolation,
          'BoundaryViolation: embedded child patch cannot generalize parent scope',
        );
      }
      if (current === '/') {
        return;
      }
      current = parentPointer(current);
    }
  }

  private enforceGeneralizationPolicy(
    root: BlueNode,
    originScope: string,
    generatedPaths: readonly string[],
  ): void {
    const normalizedOrigin = normalizeScope(originScope);
    const scopedPolicy = this.policyResolver.resolve(root, normalizedOrigin);
    const rootPolicy =
      normalizedOrigin === '/'
        ? scopedPolicy
        : this.policyResolver.resolve(root, '/');

    for (const generatedPath of generatedPaths) {
      const write = metadataWriteNodePath(generatedPath);
      if (!write) {
        continue;
      }
      const policy = scopedPolicy.appliesTo(write) ? scopedPolicy : rootPolicy;
      const rule = policy.ruleFor(write);
      const mode = rule?.mode ?? policy.defaultMode;
      if (mode === 'reject') {
        throwGeneralizationFailure(
          ProcessorErrorCategory.GeneralizationRejected,
          `GeneralizationRejected: type generalization policy rejects ${write}`,
        );
      }

      const floor = rule?.mustRemainSubtypeOf;
      if (!floor) {
        continue;
      }
      const generatedType = nodeAt(root, generatedPath)?.getBlueId() ?? null;
      if (
        !generatedType ||
        (generatedType !== floor &&
          !this.typeGraph.isSubtypeOf(generatedType, floor))
      ) {
        throwGeneralizationFailure(
          ProcessorErrorCategory.GeneralizationRejected,
          'GeneralizationRejected: type generalization would cross policy floor',
        );
      }
    }
  }
}

export function nodeAt(
  root: BlueNode | null,
  pointer: string,
): BlueNode | null {
  if (!root) {
    return null;
  }
  let current: BlueNode | null = root;
  for (const segment of splitPointer(pointer)) {
    current = descendForRead(current, segment);
    if (!current) {
      return null;
    }
  }
  return current;
}

function descendForRead(
  current: BlueNode | null,
  segment: string,
): BlueNode | null {
  if (!current) {
    return null;
  }

  const items = current.getItems();
  if (items) {
    if (!/^\d+$/.test(segment)) {
      return null;
    }
    return items[Number(segment)] ?? null;
  }

  const properties = current.getProperties();
  const next = properties?.[segment];
  if (next instanceof BlueNode) {
    return next;
  }
  return metadataChild(current, segment);
}

function metadataChild(node: BlueNode, segment: string): BlueNode | null {
  switch (segment) {
    case 'type':
      return node.getType() ?? null;
    case 'itemType':
      return node.getItemType() ?? null;
    case 'keyType':
      return node.getKeyType() ?? null;
    case 'valueType':
      return node.getValueType() ?? null;
    case 'blue':
      return node.getBlue() ?? null;
    case 'blueId':
      return node.getReferenceBlueId() == null
        ? null
        : new BlueNode().setValue(node.getReferenceBlueId() as string);
    case 'value':
      return node.getRawValue() === undefined
        ? null
        : new BlueNode().setValue(node.getValue() ?? null);
    default:
      return null;
  }
}

function typeBlueId(node: BlueNode | null | undefined): string | null {
  return node?.getType()?.getBlueId() ?? null;
}

function deepestExistingPointer(
  root: BlueNode,
  pointer: string,
): string | null {
  let current = normalizePointer(pointer);
  while (true) {
    if (nodeAt(root, current)) {
      return current;
    }
    if (current === '/') {
      return null;
    }
    current = parentPointer(current) ?? '/';
  }
}

function applyTypeWrite(
  root: BlueNode,
  pointer: string,
  typeId: string,
  generatedPaths: string[],
): string | null {
  const target = nodeAt(root, pointer);
  if (!target) {
    return null;
  }
  target.setType(new BlueNode().setBlueId(typeId));
  const generatedPath = pointer === '/' ? '/type' : `${pointer}/type`;
  if (!generatedPaths.includes(generatedPath)) {
    generatedPaths.push(generatedPath);
  }
  return generatedPath;
}

function requireNodeAt(root: BlueNode, pointer: string): BlueNode {
  const node = nodeAt(root, pointer);
  if (!node) {
    throw new Error(`Expected generated node at ${pointer}`);
  }
  return node;
}

function throwGeneralizationFailure(
  category: ProcessorErrorCategoryValue,
  message: string,
): never {
  throw new ProcessorFatalError(
    message,
    ProcessorErrors.runtimeFatal(message),
    category,
  );
}
