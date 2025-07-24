import { MergingProcessor } from './MergingProcessor';
import {
  SequentialMergingProcessor,
  ValuePropagator,
  TypeAssigner,
  ListProcessor,
  DictionaryProcessor,
  BasicTypesVerifier,
  ExpressionPreserver,
} from './processors';

/**
 * Creates the default node processor with all standard processors
 * @returns A SequentialMergingProcessor with all standard processors
 */
export function createDefaultNodeProcessor(): MergingProcessor {
  return new SequentialMergingProcessor([
    new ValuePropagator(),
    new ExpressionPreserver(),
    new TypeAssigner(),
    new ListProcessor(),
    new DictionaryProcessor(),
    new BasicTypesVerifier(),
  ]);
}
