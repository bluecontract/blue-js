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
  type BlueRepository,
  Limits,
  Nodes,
  BasicNodeProvider,
  NodeToMapListOrValue,

  // merge
  NodeResolver,
  type MergingProcessor,
  Merger,
  MergingProcessors,
} from './lib';
export * from './schema';
export * from './schema/annotations';
export * from './utils';

export { ResolvedBlueNode } from './lib/model/ResolvedNode';
