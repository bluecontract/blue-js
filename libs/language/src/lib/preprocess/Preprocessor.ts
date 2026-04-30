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
  /**
   * BlueId of the static DefaultBlue.yaml content registered by BootstrapProvider.
   * Dynamic repository mappings are appended separately and intentionally do not
   * change the bootstrap key used to reference the default transformation set.
   */
  public static readonly DEFAULT_BLUE_BLUE_ID =
    'BF4xn5LN3HzQJSmqcXRyUq4tZEtkj2eBZ8UPCDJMnhG9';

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
    defaultBlue: BlueNode | null,
  ): BlueNode {
    let processedDocument = document.clone();
    let blueNode = processedDocument.getBlue();

    if (!blueNode && defaultBlue) {
      blueNode = defaultBlue.clone();
    }

    if (blueNode) {
      new NodeExtender(this.nodeProvider).extend(
        blueNode,
        PathLimits.withSinglePath('/*'),
      );

      const transformations = this.flattenTransformationItems(
        blueNode.getItems(),
      );
      if (transformations && transformations.length > 0) {
        for (const transformation of transformations) {
          const processor = this.processorProvider.getProcessor(transformation);
          if (processor) {
            processedDocument = processor.process(processedDocument);
          } else {
            throw new Error(
              `No processor found for transformation: ${transformation}`,
            );
          }
        }

        processedDocument.setBlue(undefined);
      }

      processedDocument = new ValidateInlineTypesReplaced().process(
        processedDocument,
      );
    }

    return processedDocument;
  }

  private flattenTransformationItems(
    items: BlueNode[] | undefined,
  ): BlueNode[] | undefined {
    if (items === undefined) {
      return undefined;
    }

    return items.flatMap((item) => item.getItems() ?? [item]);
  }

  /**
   * Gets the standard transformation processor provider
   * @returns The standard provider
   */
  public static getStandardProvider(): TransformationProcessorProvider {
    return {
      getProcessor(
        transformation: BlueNode,
      ): TransformationProcessor | undefined {
        const REPLACE_INLINE_TYPES =
          '27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo';
        const INFER_BASIC_TYPES =
          'FGYuTXwaoSKfZmpTysLTLsb8WzSqf43384rKZDkXhxD4';

        const blueId = transformation.getType()?.getBlueId();

        if (REPLACE_INLINE_TYPES === blueId) {
          return new ReplaceInlineValuesForTypeAttributesWithImports(
            transformation,
          );
        } else if (INFER_BASIC_TYPES === blueId) {
          return new InferBasicTypesForUntypedValues();
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
    if (this.blueIdsMappingGenerator.getTotalBlueIdCount() === 0) {
      return defaultBlue;
    }

    const dynamicMappings = this.blueIdsMappingGenerator.generateMappingsYaml();

    return `
${defaultBlue}
${dynamicMappings}
    `;
  }

  /**
   * Loads the default simple Blue node
   */
  private loadDefaultSimpleBlue(): void {
    try {
      const enrichedDefaultBlue = this.enrichDefaultBlue(DefaultBlueYaml);
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
