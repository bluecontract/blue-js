import { BlueNode } from '../../model';
import { MergingProcessor } from '../MergingProcessor';

/**
 * Propagates metadata (name, description) from source to target.
 *
 * Child nodes inherit metadata from their type, but explicit metadata set on the
 * source node should override inherited values for the same field.
 */
export class MetadataPropagator implements MergingProcessor {
  process(target: BlueNode, source: BlueNode): BlueNode {
    let newTarget = target;

    const sourceName = source.getName();
    if (sourceName !== undefined && sourceName !== target.getName()) {
      newTarget = newTarget.cloneShallow().setName(sourceName);
    }

    const sourceDescription = source.getDescription();
    if (
      sourceDescription !== undefined &&
      sourceDescription !== newTarget.getDescription()
    ) {
      newTarget = newTarget.cloneShallow().setDescription(sourceDescription);
    }

    return newTarget;
  }
}
