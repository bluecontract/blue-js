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
  ValidateInlineTypesReplaced,
} from './processor';
import { NodeExtender } from '../utils/NodeExtender';
import { PathLimits } from '../utils/limits';
import DefaultBlueYaml from '../resources/transformation/DefaultBlue.yaml?raw';
import { BlueIdsMappingGenerator } from './utils/BlueIdsMappingGenerator';

export interface PreprocessorOptions {
  nodeProvider?: NodeProvider;
  processorProvider?: TransformationProcessorProvider;
  blueIdsMappingGenerator?: BlueIdsMappingGenerator;
}

/**
 * Preprocessor class for transforming BlueNodes
 */
export class Preprocessor {
  public static readonly DEFAULT_BLUE_BLUE_ID =
    '44qdopt1zW5xuiM2GGLHcc4D8cEg4FonexfZrzQmBLN1';

  private processorProvider: TransformationProcessorProvider;
  private nodeProvider: NodeProvider;
  private defaultSimpleBlue: BlueNode | null = null;
  private blueIdsMappingGenerator: BlueIdsMappingGenerator;

  /**
   * Creates a new Preprocessor with the specified options
   * @param options - Configuration options for the preprocessor
   */
  constructor(options: PreprocessorOptions = {}) {
    const { nodeProvider, processorProvider, blueIdsMappingGenerator } =
      options;

    // Set up node provider (required)
    if (!nodeProvider) {
      throw new Error('NodeProvider is required');
    }
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);

    // Set up processor provider (optional, defaults to standard provider)
    this.processorProvider =
      processorProvider || Preprocessor.getStandardProvider();

    // Set up BlueIds mapping generator (optional, creates new instance if not provided)
    this.blueIdsMappingGenerator =
      blueIdsMappingGenerator || new BlueIdsMappingGenerator();

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
        const VALIDATE_INLINE_TYPES_REPLACED =
          '2PTPqxkzAvUnTaSKbPHPJAVwQoLpt1N5e5JNBt91vc26';

        const blueId = transformation.getType()?.getBlueId();

        if (REPLACE_INLINE_TYPES === blueId) {
          return new ReplaceInlineValuesForTypeAttributesWithImports(
            transformation
          );
        } else if (INFER_BASIC_TYPES === blueId) {
          return new InferBasicTypesForUntypedValues();
        } else if (VALIDATE_INLINE_TYPES_REPLACED === blueId) {
          return new ValidateInlineTypesReplaced();
        }

        return undefined;
      },
    };
  }

  /**
   * Enriches the default Blue YAML with dynamic BlueIds mappings
   * @param defaultBlue - The base default Blue YAML content
   * @returns Enriched YAML content with dynamic mappings
   */
  private enrichDefaultBlue(defaultBlue: string): string {
    const dynamicMappings = this.blueIdsMappingGenerator.generateMappingsYaml();

    return `
${dynamicMappings}
${defaultBlue}
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
