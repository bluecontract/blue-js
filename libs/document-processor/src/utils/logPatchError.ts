import {
  PatchApplicationError,
  EmbeddedDocumentModificationError,
} from './exceptions';
import { EventNode } from '../types';

export const logPatchError = (
  contractName: string,
  event: EventNode,
  err: unknown,
) => {
  if (
    err instanceof PatchApplicationError ||
    err instanceof EmbeddedDocumentModificationError
  ) {
    console.error(
      `[Blue] Failed to apply patches for contract "${contractName}" ` +
        `on event ${JSON.stringify(event)}`,
      err,
    );
  }
};
