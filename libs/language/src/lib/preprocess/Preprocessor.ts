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
import { BlueIds } from '../utils/BlueIds';
import {
  DEFAULT_BLUE_TYPE_NAME_TO_BLUE_ID_MAP,
  LIST_CONTROL_EMPTY,
} from '../utils/Properties';
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
    'EsyNgNY4ZZeCvWiGLQM52WPJ7HF5kz3DyCoxdDDaauc6';

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
    let processedDocument = this.applyPortableImports(
      this.normalizeListPlaceholders(document.clone(), false),
    );
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

  private applyPortableImports(document: BlueNode): BlueNode {
    const blueNode = document.getBlue();
    const importsNode = blueNode?.getProperties()?.imports;
    if (importsNode === undefined) {
      return document;
    }
    const imports = importsNode.getProperties();
    if (
      imports === undefined ||
      importsNode.getValue() !== undefined ||
      importsNode.getItems() !== undefined ||
      importsNode.getReferenceBlueId() !== undefined
    ) {
      throw new Error(
        'blue.imports must be an object mapping aliases to pure references.',
      );
    }

    const mappings = new Map<string, string>();
    for (const [alias, reference] of Object.entries(imports)) {
      if (!this.isReferenceOnly(reference)) {
        throw new Error(`blue.imports.${alias} must be a pure reference.`);
      }
      const blueId = BlueIds.requirePlainBlueId(
        reference.getReferenceBlueId(),
        `blue.imports.${alias}`,
      );
      const defaultBlueId = (
        DEFAULT_BLUE_TYPE_NAME_TO_BLUE_ID_MAP as Record<string, string>
      )[alias];
      if (defaultBlueId !== undefined && defaultBlueId !== blueId) {
        throw new Error(
          `blue.imports cannot redefine default Blue alias "${alias}".`,
        );
      }
      mappings.set(alias, blueId);
    }

    const transformed = new ReplaceInlineValuesForTypeAttributesWithImports(
      mappings,
    ).process(document);
    const transformedBlue = transformed.getBlue();
    if (transformedBlue !== undefined) {
      transformedBlue.removeProperty('imports');
      if (this.isEmptyNode(transformedBlue)) {
        transformed.setBlue(undefined);
      }
    }
    return transformed;
  }

  private normalizeListPlaceholders(
    node: BlueNode,
    listElement: boolean,
  ): BlueNode {
    if (listElement && this.isEmptyPlaceholder(node)) {
      return node.clone();
    }
    if (listElement && (this.isNullNode(node) || this.isEmptyNode(node))) {
      return this.emptyPlaceholder();
    }

    const normalized = node.clone();
    const type = normalized.getType();
    if (type !== undefined) {
      normalized.setType(this.normalizeListPlaceholders(type, false));
    }
    const itemType = normalized.getItemType();
    if (itemType !== undefined) {
      normalized.setItemType(this.normalizeListPlaceholders(itemType, false));
    }
    const keyType = normalized.getKeyType();
    if (keyType !== undefined) {
      normalized.setKeyType(this.normalizeListPlaceholders(keyType, false));
    }
    const valueType = normalized.getValueType();
    if (valueType !== undefined) {
      normalized.setValueType(this.normalizeListPlaceholders(valueType, false));
    }
    const blue = normalized.getBlue();
    if (blue !== undefined) {
      normalized.setBlue(this.normalizeListPlaceholders(blue, false));
    }
    const contracts = normalized.getContractsNode();
    if (contracts !== undefined) {
      normalized.setContractsNode(
        this.normalizeListPlaceholders(contracts, false),
      );
    }
    const items = normalized.getItems();
    if (items !== undefined) {
      normalized.setItems(
        items.map((item) => this.normalizeListPlaceholders(item, true)),
      );
    }
    const properties = normalized.getProperties();
    if (properties !== undefined) {
      const normalizedProperties = Object.fromEntries(
        Object.entries(properties).flatMap(([key, value]) => {
          const child = this.normalizeListPlaceholders(value, false);
          return this.isEmptyNode(child) || this.isNullNode(child)
            ? []
            : [[key, child]];
        }),
      );
      normalized.setProperties(
        Object.keys(normalizedProperties).length === 0
          ? undefined
          : normalizedProperties,
      );
    }
    return listElement && this.isEmptyNode(normalized)
      ? this.emptyPlaceholder()
      : normalized;
  }

  private emptyPlaceholder(): BlueNode {
    return new BlueNode().addProperty(
      LIST_CONTROL_EMPTY,
      new BlueNode().setValue(true),
    );
  }

  private isEmptyPlaceholder(node: BlueNode): boolean {
    const properties = node.getProperties();
    return (
      properties !== undefined &&
      Object.keys(properties).length === 1 &&
      properties[LIST_CONTROL_EMPTY]?.getValue() === true
    );
  }

  private isNullNode(node: BlueNode): boolean {
    return (
      node.getValue() === null &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItems() === undefined &&
      node.getProperties() === undefined
    );
  }

  private isReferenceOnly(node: BlueNode): boolean {
    return (
      node.getReferenceBlueId() !== undefined &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      node.getValue() === undefined &&
      node.getItems() === undefined &&
      node.getProperties() === undefined
    );
  }

  private isEmptyNode(node: BlueNode): boolean {
    return (
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      node.getValue() === undefined &&
      node.getItems() === undefined &&
      (node.getProperties() === undefined ||
        Object.keys(node.getProperties() ?? {}).length === 0) &&
      node.getContractsNode() === undefined &&
      node.getReferenceBlueId() === undefined &&
      node.getSchema() === undefined &&
      node.getMergePolicy() === undefined
    );
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
