import { Blue, BlueNode, type Node } from '@blue-labs/language';

import { KEY_CHECKPOINT } from '../constants/processor-contract-constants.js';
import {
  relativeCheckpointLastEvent,
  relativeCheckpointLastSignature,
  RELATIVE_CHECKPOINT,
} from '../constants/processor-pointer-constants.js';
import { resolvePointer } from '../util/pointer-utils.js';
import type { ContractBundle } from './contract-bundle.js';
import type { ChannelEventCheckpoint, MarkerContract } from '../model/index.js';
import { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';

const blueHelper = new Blue();

function createEmptyCheckpointNode(): Node {
  return blueHelper.jsonValueToNode({
    type: { blueId: 'ChannelEventCheckpoint' },
    lastEvents: {},
    lastSignatures: {},
  });
}

function createEmptyCheckpointContract(): ChannelEventCheckpoint {
  return {
    key: KEY_CHECKPOINT,
    lastEvents: {},
    lastSignatures: {},
  };
}

function isChannelEventCheckpoint(
  marker: MarkerContract,
): marker is ChannelEventCheckpoint {
  return (
    marker != null &&
    Object.prototype.hasOwnProperty.call(marker, 'lastEvents') &&
    Object.prototype.hasOwnProperty.call(marker, 'lastSignatures')
  );
}

export class CheckpointRecord {
  lastEventNode: Node | null;
  lastEventSignature: string | null;

  constructor(
    readonly markerKey: string,
    readonly checkpoint: ChannelEventCheckpoint,
    readonly channelKey: string,
    lastEventNode: Node | null,
    lastEventSignature: string | null,
  ) {
    this.lastEventNode = lastEventNode;
    this.lastEventSignature = lastEventSignature;
  }

  matches(signature: string | null | undefined): boolean {
    return signature != null && signature === this.lastEventSignature;
  }
}

export class CheckpointManager {
  constructor(
    private readonly runtime: DocumentProcessingRuntime,
    private readonly signatureFn: (node: Node | null) => string | null,
  ) {}

  ensureCheckpointMarker(scopePath: string, bundle: ContractBundle): void {
    const marker = bundle.marker(KEY_CHECKPOINT);
    const pointer = resolvePointer(scopePath, RELATIVE_CHECKPOINT);
    if (!marker) {
      const markerNode = createEmptyCheckpointNode();
      this.runtime.directWrite(pointer, markerNode);
      bundle.registerCheckpointMarker(createEmptyCheckpointContract());
      return;
    }
    if (!isChannelEventCheckpoint(marker)) {
      throw new Error(
        `Reserved key 'checkpoint' must contain a Channel Event Checkpoint at ${pointer}`,
      );
    }
  }

  findCheckpoint(bundle: ContractBundle, channelKey: string): CheckpointRecord | null {
    for (const [markerKey, marker] of bundle.markerEntries()) {
      if (!isChannelEventCheckpoint(marker)) {
        continue;
      }
      const stored = marker.lastEvents?.[channelKey] ?? null;
      const storedClone = stored ? stored.clone() : null;
      const storedSignature = marker.lastSignatures?.[channelKey] ?? null;
      const signature = storedSignature ?? this.signatureFn(storedClone);
      return new CheckpointRecord(markerKey, marker, channelKey, storedClone, signature);
    }
    return null;
  }

  isDuplicate(record: CheckpointRecord | null, signature: string | null | undefined): boolean {
    return record != null && record.matches(signature);
  }

  persist(
    scopePath: string,
    bundle: ContractBundle,
    record: CheckpointRecord | null,
    eventSignature: string | null,
    eventNode: Node | null,
  ): void {
    if (!record) {
      return;
    }
    const eventPointer = resolvePointer(
      scopePath,
      relativeCheckpointLastEvent(record.markerKey, record.channelKey),
    );
    const stored = eventNode ? eventNode.clone() : null;
    this.runtime.chargeCheckpointUpdate();
    this.runtime.directWrite(eventPointer, stored);

    if (!record.checkpoint.lastEvents) {
      record.checkpoint.lastEvents = {};
    }
    if (stored) {
      record.checkpoint.lastEvents[record.channelKey] = stored.clone();
    } else {
      delete record.checkpoint.lastEvents[record.channelKey];
    }
    record.lastEventNode = stored ? stored.clone() : null;

    const signaturePointer = resolvePointer(
      scopePath,
      relativeCheckpointLastSignature(record.markerKey, record.channelKey),
    );
    const signatureNode = eventSignature == null
      ? null
      : new BlueNode().setValue(eventSignature);
    this.runtime.directWrite(signaturePointer, signatureNode);

    if (!record.checkpoint.lastSignatures) {
      record.checkpoint.lastSignatures = {};
    }
    if (eventSignature == null) {
      delete record.checkpoint.lastSignatures[record.channelKey];
    } else {
      record.checkpoint.lastSignatures[record.channelKey] = eventSignature;
    }
    record.lastEventSignature = eventSignature ?? null;
  }
}
