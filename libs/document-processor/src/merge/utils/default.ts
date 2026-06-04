import { MergingProcessor, MergingProcessors } from '@blue-labs/language';
import { BexExpressionPreserver } from '../processors/index.js';

/**
 * Creates the default node processor with all standard processors
 * @returns A SequentialMergingProcessor with all standard processors
 */
export function createDefaultMergingProcessor(): MergingProcessor {
  return new MergingProcessors.SequentialMergingProcessor([
    new BexExpressionPreserver(),
    new MergingProcessors.ValuePropagator(),
    new MergingProcessors.TypeAssigner(),
    new MergingProcessors.ListProcessor(),
    new MergingProcessors.DictionaryProcessor(),
    new MergingProcessors.MetadataPropagator(),
    new MergingProcessors.BasicTypesVerifier(),
  ]);
}
