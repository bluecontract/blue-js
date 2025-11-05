import { BlueNode } from '@blue-labs/language';

export type DocumentUpdateOp = 'add' | 'replace' | 'remove';

export interface DocumentUpdate {
  readonly op: DocumentUpdateOp;
  readonly path: string;
  /**
   * Snapshot of the document value before the update, already cloned for event delivery.
   */
  readonly before: BlueNode | null;
  /**
   * Snapshot of the document value after the update, already cloned for event delivery.
   */
  readonly after: BlueNode | null;
}
