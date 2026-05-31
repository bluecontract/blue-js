import type { BexDocumentView, BexValue } from '@blue-labs/bex';
import { BexValues } from '@blue-labs/bex';

import type { ContractProcessorContext } from '../../types.js';

export class ProcessorBexDocumentView implements BexDocumentView {
  constructor(
    private readonly context: ContractProcessorContext,
    private readonly scopeRootPointer: string,
  ) {}

  canonicalAt(pointer: string): BexValue {
    return this.valueAt(pointer);
  }

  resolvedAt(pointer: string): BexValue {
    return this.valueAt(pointer);
  }

  private valueAt(pointer: string): BexValue {
    const node =
      this.context.documentAt(this.resolvePointer(pointer)) ?? undefined;
    return BexValues.nodeValueSnapshot(node, {
      compactListsWithMetadata: true,
      compactScalarsWithMetadata: true,
      omitMetadataOnly: true,
    });
  }

  private resolvePointer(pointer: string): string {
    const normalized = pointer.startsWith('/') ? pointer : `/${pointer}`;
    if (this.scopeRootPointer === '/') {
      return normalized;
    }
    if (normalized === '/') {
      return this.scopeRootPointer;
    }
    return `${this.scopeRootPointer}${normalized}`;
  }
}
