import { DocumentNode, EventNode } from '../types';
import { makePath } from './path';
import { BlueNode, BlueNodePatch } from '@blue-labs/language';

type Entry = { docBase: string; event: EventNode; eventBlueId: string };

const hasPath = (obj: BlueNode, path: string): boolean => {
  return obj.get(path) !== undefined;
};

export class CheckpointCache {
  private firstSeen = new Map<string, Entry>();

  record(docBase: string, event: EventNode, eventBlueId: string) {
    const k = docBase;
    if (!this.firstSeen.has(k)) {
      this.firstSeen.set(k, { docBase, event, eventBlueId });
    }
  }

  /** Turn cached data into JSON-Patch ops */
  flush(document: DocumentNode): BlueNodePatch[] {
    const patches: BlueNodePatch[] = [];

    for (const { docBase, event, eventBlueId } of this.firstSeen.values()) {
      if (!event.channelName) continue;

      const chanBase = makePath(
        docBase,
        'contracts/checkpoint/lastEvents',
        event.channelName,
      );
      const blueIdPath = `${chanBase}/blueId`;

      if (!hasPath(document, chanBase)) {
        patches.push({
          op: 'add',
          path: chanBase,
          val: { blueId: eventBlueId },
        });
      } else {
        patches.push({
          op: hasPath(document, blueIdPath) ? 'replace' : 'add',
          path: blueIdPath,
          val: eventBlueId,
        });
      }
    }

    return patches;
  }

  clear() {
    this.firstSeen.clear();
  }
}
