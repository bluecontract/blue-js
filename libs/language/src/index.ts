export {
  BlueNode,
  type UrlFetchStrategy,
  BlueIdCalculator,
  JsonCanonicalizer,
  BlueIdToCid,
  Base58Sha256Provider,
  TypeSchemaResolver,
  Blue,
  applyBlueNodePatch,
  type BlueNodePatch,
  BlueNodeTypeSchema,
  NodeDeserializer,
  type BlueRepository,
  Limits,
  Nodes,
  BasicNodeProvider,

  // merge
  NodeResolver,
  type MergingProcessor,
  Merger,
  MergingProcessors,
} from './lib';
export {
  TEXT_TYPE,
  DOUBLE_TYPE,
  INTEGER_TYPE,
  BOOLEAN_TYPE,
  LIST_TYPE,
  DICTIONARY_TYPE,
  BASIC_TYPES,
  CORE_TYPES,
  TEXT_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  DICTIONARY_TYPE_BLUE_ID,
  BASIC_TYPE_BLUE_IDS,
  CORE_TYPE_BLUE_IDS,
  CORE_TYPE_NAME_TO_BLUE_ID_MAP,
  CORE_TYPE_BLUE_ID_TO_NAME_MAP,
} from './lib/utils/Properties';
export * from './schema';
export * from './schema/annotations';
export * from './utils';

export { ResolvedBlueNode } from './lib/model/ResolvedNode';
