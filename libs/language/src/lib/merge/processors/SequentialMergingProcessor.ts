import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';
import { NodeResolver } from '../NodeResolver';

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
    nodeResolver: NodeResolver
  ): BlueNode {
    return this.mergingProcessors.reduce(
      (currentTarget, processor) =>
        processor.process(currentTarget, source, nodeProvider, nodeResolver),
      target
    );
  }

  /**
   * Post-processes all contained processors in sequence
   */
  postProcess(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
    nodeResolver: NodeResolver
  ): BlueNode {
    return this.mergingProcessors.reduce((currentPostTarget, processor) => {
      if (processor.postProcess) {
        return processor.postProcess(
          currentPostTarget,
          source,
          nodeProvider,
          nodeResolver
        );
      }
      return currentPostTarget;
    }, target);
  }
}
