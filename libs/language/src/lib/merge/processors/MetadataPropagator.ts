import { BlueNode } from '../../model';
import { MergingProcessor } from '../MergingProcessor';

/**
 * Propagates metadata (name, description) from source to target when target is missing it.
 *
 * This ensures that when a source node provides metadata (e.g., payload-provided
 * `name`), it is preserved after merging with type-provided nodes which typically
 * carry descriptions but not names.
 */
export class MetadataPropagator implements MergingProcessor {
  process(target: BlueNode, source: BlueNode): BlueNode {
    let newTarget = target;

    const sourceName = source.getName();
    const targetName = target.getName();
    if (sourceName !== undefined && targetName === undefined) {
      newTarget = newTarget.cloneShallow().setName(sourceName);
    }

    const sourceDescription = source.getDescription();
    const targetDescription = newTarget.getDescription();
    if (sourceDescription !== undefined && targetDescription === undefined) {
      newTarget = newTarget.cloneShallow().setDescription(sourceDescription);
    }

    return newTarget;
  }
}
