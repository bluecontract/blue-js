import { BlueNode } from '../model';

/**
 * Interface for processors that transform BlueNodes
 */
export interface TransformationProcessor {
  /**
   * Process a document node
   * @param document - The document to process
   * @returns The processed document
   */
  process(document: BlueNode): BlueNode;
}

/**
 * Provider interface for transformation processors
 */
export interface TransformationProcessorProvider {
  /**
   * Get a processor for the given transformation node
   * @param transformation - The transformation node
   * @returns The processor, or undefined if no processor is available
   */
  getProcessor(transformation: BlueNode): TransformationProcessor | undefined;
}
