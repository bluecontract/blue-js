import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';

/**
 * A MergingProcessor that executes multiple processors in sequence
 */
export class SequentialMergingProcessor implements MergingProcessor {
  private readonly mergingProcessors: MergingProcessor[];

  /**
   * Creates a new SequentialMergingProcessor with the given processors
   * @param mergingProcessors - Array of processors to execute in sequence
   */
  constructor(mergingProcessors: MergingProcessor[]) {
    this.mergingProcessors = mergingProcessors;
  }

  /**
   * Processes all contained processors in sequence
   */
  process(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
  ): BlueNode {
    return this.mergingProcessors.reduce(
      (currentTarget, processor) =>
        processor.process(currentTarget, source, nodeProvider),
      target,
    );
  }

  preserveSource(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
  ): BlueNode | undefined {
    for (const processor of this.mergingProcessors) {
      const preserved = processor.preserveSource?.(
        target,
        source,
        nodeProvider,
      );
      if (preserved !== undefined) {
        return preserved;
      }
    }
    return undefined;
  }

  shouldPreserveSource(source: BlueNode, nodeProvider: NodeProvider): boolean {
    return this.mergingProcessors.some((processor) =>
      processor.shouldPreserveSource?.(source, nodeProvider),
    );
  }

  /**
   * Post-processes all contained processors in sequence
   */
  postProcess(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
  ): BlueNode {
    return this.mergingProcessors.reduce((currentPostTarget, processor) => {
      if (processor.postProcess) {
        return processor.postProcess(currentPostTarget, source, nodeProvider);
      }
      return currentPostTarget;
    }, target);
  }
}
