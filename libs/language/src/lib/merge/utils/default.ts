import { MergingProcessor } from '../MergingProcessor';
import {
  SequentialMergingProcessor,
  ValuePropagator,
  TypeAssigner,
  ListProcessor,
  DictionaryProcessor,
  BasicTypesVerifier,
  MetadataPropagator,
} from '../processors';

/**
 * Creates the default node processor with all standard processors
 * @returns A SequentialMergingProcessor with all standard processors
 */
export function createDefaultMergingProcessor(): MergingProcessor {
  return new SequentialMergingProcessor([
    new ValuePropagator(),
    new TypeAssigner(),
    new ListProcessor(),
    new DictionaryProcessor(),
    new MetadataPropagator(),
    new BasicTypesVerifier(),
  ]);
}
