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

/**
 * Preprocessor class for transforming BlueNodes
 */
export class Preprocessor {
  // Default Blue ID for the default Blue transformation
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
      // TODO
      // new NodeExtender(nodeProvider).extend(blueNode, PathLimits.withSinglePath("/*"));

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

        // Clear the blue node after processing
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

        // Using path accessor to get blueId; getAsText isn't available in the BlueNode class
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

  /**
   * Loads the default simple Blue node
   */
  private loadDefaultSimpleBlue(): void {
    try {
      // Load the DefaultBlue.blue content
      const defaultBlueContent = `
- type:
    blueId: 27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo
  mappings:
    Text: F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP
    Double: 68ryJtnmui4j5rCZWUnkZ3DChtmEb7Z9F8atn1mBSM3L
    Integer: DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8
    Boolean: EL6AjrbJsxTWRTPzY8WR8Y2zAMXRbydQj83PcZwuAHbo
    List: G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB
    Dictionary: 294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA
- type:
    blueId: FGYuTXwaoSKfZmpTysLTLsb8WzSqf43384rKZDkXhxD4
`;

      // Parse the yaml content using NodeDeserializer
      const parsedYaml = yamlBlueParse(defaultBlueContent);
      if (parsedYaml) {
        // Create the default Blue node
        this.defaultSimpleBlue = NodeDeserializer.deserialize(parsedYaml);
      } else {
        throw new Error('Failed to parse default Blue content');
      }
    } catch (e) {
      throw new Error(`Error loading default Blue: ${e}`);
    }
  }
}
