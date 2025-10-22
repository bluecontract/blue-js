import type { Node } from '../../types/index.js';

export type DocumentUpdateOp = 'add' | 'replace' | 'remove';

export interface DocumentUpdate {
  readonly type: 'Document Update';
  readonly op: DocumentUpdateOp;
  readonly path: string;
  /**
   * Snapshot of the document value before the update, already cloned for event delivery.
   */
  readonly before: Node | null;
  /**
   * Snapshot of the document value after the update, already cloned for event delivery.
   */
  readonly after: Node | null;
}
