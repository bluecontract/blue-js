import { type BlueNodePatch } from '@blue-labs/language';

/** Custom error gives you the offending patch for logging / alerting */
export class PatchApplicationError extends Error {
  constructor(
    readonly patch: BlueNodePatch,
    override readonly cause?: unknown
  ) {
    super(`Cannot apply patch ${JSON.stringify(patch)}`);
    this.name = 'PatchApplicationError';
  }
}

/** Thrown when a patch targets a path protected by a Process Embedded contract */
export class EmbeddedDocumentModificationError extends Error {
  constructor(
    readonly patch: BlueNodePatch,
    readonly offendingPath: string, // the embedded path that was hit
    readonly contractNodePath: string // where the Process Embedded contract sits
  ) {
    super(
      `Patch ${JSON.stringify(patch)} touches "${
        patch.op === 'move' || patch.op === 'copy'
          ? `${patch.from} → ${patch.path}`
          : patch.path
      }" which is inside embedded document "${offendingPath}" (Process Embedded @ "${contractNodePath}")`
    );
    this.name = 'EmbeddedDocumentModificationError';
  }
}

/** Thrown when a document update expression fails to evaluate */
export class ExpressionEvaluationError extends Error {
  constructor(readonly code: string, override readonly cause?: unknown) {
    super(`Failed to evaluate expression "${code}"`);
    this.name = 'ExpressionEvaluationError';
  }
}

/** Thrown when a step code block fails to evaluate */
export class CodeBlockEvaluationError extends Error {
  constructor(readonly code: string, override readonly cause?: unknown) {
    super(`Failed to evaluate code block "${code}"`);
    this.name = 'CodeBlockEvaluationError';
  }
}

export { GasBudgetExceededError } from './GasMeter';
