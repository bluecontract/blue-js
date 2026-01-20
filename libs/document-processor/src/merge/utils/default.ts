import { MergingProcessor, MergingProcessors } from '@blue-labs/language';
import { ExpressionPreserver } from '../processors/ExpressionPreserver.js';

/**
 * Creates the default node processor with all standard processors
 * @returns A SequentialMergingProcessor with all standard processors
 */
export function createDefaultMergingProcessor(): MergingProcessor {
  return new MergingProcessors.SequentialMergingProcessor([
    new MergingProcessors.ValuePropagator(),
    new ExpressionPreserver(),
    new MergingProcessors.TypeAssigner(),
    new MergingProcessors.ListProcessor(),
    new MergingProcessors.DictionaryProcessor(),
    new MergingProcessors.MetadataPropagator(),
    new MergingProcessors.BasicTypesVerifier(),
  ]);
}
