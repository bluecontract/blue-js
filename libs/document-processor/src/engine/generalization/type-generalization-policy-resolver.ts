import { BlueNode } from '@blue-labs/language';

import {
  normalizePointer,
  normalizeScope,
  resolvePointer,
} from '../../util/pointer-utils.js';
import { descendantOrEqual } from './type-generalization-pointer-utils.js';

export interface GeneralizationRule {
  readonly path: string;
  readonly mode: string | null;
  readonly mustRemainSubtypeOf: string | null;
}

export class TypeGeneralizationPolicy {
  constructor(
    readonly present: boolean,
    readonly scope: string,
    readonly defaultMode: string,
    private readonly rules: readonly GeneralizationRule[],
  ) {}

  appliesTo(pointer: string): boolean {
    return this.present && descendantOrEqual(pointer, this.scope);
  }

  ruleFor(pointer: string): GeneralizationRule | null {
    let best: GeneralizationRule | null = null;
    for (const rule of this.rules) {
      if (!descendantOrEqual(pointer, rule.path)) {
        continue;
      }
      if (!best || rule.path.length >= best.path.length) {
        best = rule;
      }
    }
    return best;
  }
}

export class TypeGeneralizationPolicyResolver {
  constructor(
    private readonly nodeAt: (
      root: BlueNode | null,
      pointer: string,
    ) => BlueNode | null,
  ) {}

  resolve(root: BlueNode, scope: string): TypeGeneralizationPolicy {
    const normalizedScope = normalizeScope(scope);
    const marker = this.nodeAt(
      root,
      resolvePointer(normalizedScope, '/contracts/generalization'),
    );
    if (!marker) {
      return new TypeGeneralizationPolicy(
        false,
        normalizedScope,
        'nearest-valid',
        [],
      );
    }

    const rules: GeneralizationRule[] = [];
    const rulesNode = marker.getProperties()?.rules;
    for (const item of rulesNode?.getItems() ?? []) {
      const pathValue = this.textField(item, 'path');
      if (!pathValue) {
        continue;
      }
      rules.push({
        path: resolvePointer(normalizedScope, normalizePointer(pathValue)),
        mode: this.textField(item, 'mode'),
        mustRemainSubtypeOf: this.blueIdField(item, 'mustRemainSubtypeOf'),
      });
    }

    return new TypeGeneralizationPolicy(
      true,
      normalizedScope,
      this.textField(marker, 'defaultMode') ?? 'nearest-valid',
      rules,
    );
  }

  private textField(node: BlueNode, key: string): string | null {
    const value = node.getProperties()?.[key]?.getValue();
    return value == null ? null : String(value);
  }

  private blueIdField(node: BlueNode, key: string): string | null {
    const field = node.getProperties()?.[key];
    if (!field) {
      return null;
    }
    if (field.getBlueId()) {
      return field.getBlueId() ?? null;
    }
    const value = field.getValue();
    if (value != null) {
      return String(value);
    }
    const nested = field.getProperties()?.blueId?.getValue();
    return nested == null ? null : String(nested);
  }
}
