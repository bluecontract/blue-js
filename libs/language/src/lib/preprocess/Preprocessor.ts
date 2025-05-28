import { NodeProvider } from '../NodeProvider';
import { BlueNode } from '../model';
import { NodeProviderWrapper } from '../utils/NodeProviderWrapper';
import { yamlBlueParse } from '../../utils';
import { NodeDeserializer } from '../model/NodeDeserializer';
import {
  TransformationProcessor,
  TransformationProcessorProvider,
} from './interfaces';
import {
  InferBasicTypesForUntypedValues,
  ReplaceInlineValuesForTypeAttributesWithImports,
} from './processor';
import { NodeExtender } from '../utils/NodeExtender';
import { PathLimits } from '../utils/limits';
import DefaultBlueYaml from '../resources/transformation/DefaultBlue.yaml?raw';

/**
 * Preprocessor class for transforming BlueNodes
 */
export class Preprocessor {
  public static readonly DEFAULT_BLUE_BLUE_ID =
    'FREHAAGDZSzpnoTUoCQ86bBmxbVCULMjvx9JZM6fyqT1';

  private processorProvider: TransformationProcessorProvider;
  private nodeProvider: NodeProvider;
  private defaultSimpleBlue: BlueNode | null = null;

  /**
   * Creates a new Preprocessor with the specified provider and NodeProvider or just NodeProvider
   * @param processorProviderOrNodeProvider - The TransformationProcessorProvider or NodeProvider to use
   * @param nodeProvider - The NodeProvider to use for resolving nodes (optional)
   */
  constructor(
    processorProviderOrNodeProvider:
      | TransformationProcessorProvider
      | NodeProvider,
    nodeProvider?: NodeProvider
  ) {
    if (nodeProvider) {
      // First constructor signature (processorProvider, nodeProvider)
      this.processorProvider =
        processorProviderOrNodeProvider as TransformationProcessorProvider;
      this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
    } else {
      // Second constructor signature (nodeProvider only)
      this.processorProvider = Preprocessor.getStandardProvider();
      this.nodeProvider = NodeProviderWrapper.wrap(
        processorProviderOrNodeProvider as NodeProvider
      );
    }
    this.loadDefaultSimpleBlue();
  }

  /**
   * Preprocesses a document node
   * @param document - The document node to preprocess
   * @returns The preprocessed document
   */
  public preprocess(document: BlueNode): BlueNode {
    return this.preprocessWithOptions(document, null);
  }

  /**
   * Preprocesses a document node using the default Blue node
   * @param document - The document node to preprocess
   * @returns The preprocessed document
   */
  public preprocessWithDefaultBlue(document: BlueNode): BlueNode {
    return this.preprocessWithOptions(document, this.defaultSimpleBlue);
  }

  /**
   * Preprocesses a document node with the specified default Blue node
   * @param document - The document node to preprocess
   * @param defaultBlue - The default Blue node to use if the document doesn't have one
   * @returns The preprocessed document
   */
  private preprocessWithOptions(
    document: BlueNode,
    defaultBlue: BlueNode | null
  ): BlueNode {
    let processedDocument = document.clone();
    let blueNode = processedDocument.getBlue();

    if (!blueNode && defaultBlue) {
      blueNode = defaultBlue.clone();
    }

    if (blueNode) {
      new NodeExtender(this.nodeProvider).extend(
        blueNode,
        PathLimits.withSinglePath('/*')
      );

      const transformations = blueNode.getItems();
      if (transformations && transformations.length > 0) {
        for (const transformation of transformations) {
          const processor = this.processorProvider.getProcessor(transformation);
          if (processor) {
            processedDocument = processor.process(processedDocument);
          } else {
            throw new Error(
              `No processor found for transformation: ${transformation}`
            );
          }
        }

        processedDocument.setBlue(undefined);
      }
    }

    return processedDocument;
  }

  /**
   * Gets the standard transformation processor provider
   * @returns The standard provider
   */
  public static getStandardProvider(): TransformationProcessorProvider {
    return {
      getProcessor(
        transformation: BlueNode
      ): TransformationProcessor | undefined {
        const REPLACE_INLINE_TYPES =
          '27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo';
        const INFER_BASIC_TYPES =
          'FGYuTXwaoSKfZmpTysLTLsb8WzSqf43384rKZDkXhxD4';

        const blueId = transformation.getType()?.getBlueId();

        if (REPLACE_INLINE_TYPES === blueId) {
          return new ReplaceInlineValuesForTypeAttributesWithImports(
            transformation
          );
        } else if (INFER_BASIC_TYPES === blueId) {
          return new InferBasicTypesForUntypedValues();
        }

        return undefined;
      },
    };
  }

  private enrichDefaultBlue(defaultBlue: string): string {
    return `
${defaultBlue}
- type:
    blueId: 27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo
  mappings:
    Channel: 2RMkKoutP5qxkh3uDxZ7dr6Eo27B7fuxQCS1VAptiCPc
    Timeline Channel: RMkKoutP5qxkh3uDxZ7dr6Eo27B7fuxQCS1VAptiCPc2
    Composite Timeline Channel: qxkh3uMkKoutP5DxZ7dr6Eo27B7fuxQCS1VAptiCPc2R
    MyOS Timeline Channel: MkKoutP5qxkh3uDxZ7dr6Eo27B7fuxQCS1VAptiCPc2R
    Sequential Workflow: h3uDxZ7dr6Eo27B7fuxMkKoutP5qxkQCS1VAptiCPc2R
    Sequential Workflow Step: 6EoMkKoutP5DxZ7drqxkh3u27B7fuxQCS1VAptiCPc2R
    Process Embedded: DxZ7dr6EoMkKoutP5qxkh3u27B7fuxQCS1VAptiCPc2R
    Embedded Node Channel: MkKoutP5qxkh3uDxZ7dr6Eo27B7fuxQCS1VAptiCPc2
    Document Update Channel: MkKoutP5qxkh3uDQCS1VAptiCPc2xZ7dr6Eo27B7fux
    Channel Event Checkpoint: o27B7fuxMkKoutPh3uDxZ7dr6E5qxkQCS1VAptiCPc2R
    Update Document: 7fuxMkKoutPh3uDxZ7dr6E5qxkQCS1VAptiCPc2R
    Trigger Event: kQCS1VAp7fuxMkKoutPh3uDxZ7dr6E5qxtiCPc2R
    Json Patch Entry: EnUQeMiMa2wHFW3JbeSPvdgfpL6qZYCR29m3SfeHsKSY
    JavaScript Code: MkKoutPDxZ7dr6Eo5qxkh3u27B7fuxQCS1VAptiCPc2R
    `;
  }

  /**
   * Loads the default simple Blue node
   */
  private loadDefaultSimpleBlue(): void {
    const enrichedDefaultBlue = this.enrichDefaultBlue(DefaultBlueYaml);
    try {
      const parsedYaml = yamlBlueParse(enrichedDefaultBlue);
      if (parsedYaml) {
        this.defaultSimpleBlue = NodeDeserializer.deserialize(parsedYaml);
      } else {
        throw new Error('Failed to parse default Blue content');
      }
    } catch (e) {
      throw new Error(`Error loading default Blue: ${e}`);
    }
  }
}
