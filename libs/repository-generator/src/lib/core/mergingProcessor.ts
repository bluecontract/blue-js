import { type MergingProcessor, MergingProcessors } from '@blue-labs/language';
import { ExpressionPreserver } from './ExpressionPreserver';

export function createRepositoryGeneratorMergingProcessor(): MergingProcessor {
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
