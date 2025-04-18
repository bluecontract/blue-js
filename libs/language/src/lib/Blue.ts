import { blueObjectSchema, JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { NodeProvider, createNodeProvider } from './NodeProvider';
import { NodeToMapListOrValue, TypeSchemaResolver, BlueIds } from './utils';
import { NodeProviderWrapper } from './utils/NodeProviderWrapper';
import { ZodTypeDef, ZodType } from 'zod';
import { calculateBlueId, calculateBlueIdSync, yamlBlueParse } from '../utils';
import { Preprocessor } from './preprocess/Preprocessor';

export class Blue {
  private nodeProvider: NodeProvider;
  private typeSchemaResolver: TypeSchemaResolver | null;
  private preprocessingAliases: Map<string, string> = new Map();

  /**
   * Create a new Blue instance with default NodeProvider
   */
  constructor();

  /**
   * Create a new Blue instance with custom NodeProvider
   * @param nodeProvider The NodeProvider to use
   */
  constructor(nodeProvider: NodeProvider);

  /**
   * Create a new Blue instance with custom TypeSchemaResolver
   * @param typeSchemaResolver The TypeSchemaResolver to use
   */
  constructor(typeSchemaResolver: TypeSchemaResolver);

  /**
   * Create a new Blue instance with custom NodeProvider and TypeSchemaResolver
   * @param nodeProvider The NodeProvider to use
   * @param typeSchemaResolver The TypeSchemaResolver to use
   */
  constructor(
    nodeProvider: NodeProvider,
    typeSchemaResolver: TypeSchemaResolver
  );

  constructor(
    nodeProviderOrResolver?: NodeProvider | TypeSchemaResolver,
    maybeTypeSchemaResolver?: TypeSchemaResolver
  ) {
    let nodeProvider: NodeProvider | undefined;
    if (nodeProviderOrResolver instanceof NodeProvider) {
      nodeProvider = nodeProviderOrResolver;
    }

    const defaultProvider = createNodeProvider(() => []);
    this.nodeProvider = NodeProviderWrapper.wrap(
      nodeProvider || defaultProvider
    );

    if (maybeTypeSchemaResolver) {
      this.typeSchemaResolver = maybeTypeSchemaResolver;
    } else if (
      nodeProviderOrResolver &&
      !(nodeProviderOrResolver instanceof NodeProvider)
    ) {
      this.typeSchemaResolver = nodeProviderOrResolver;
    } else {
      this.typeSchemaResolver = null;
    }
  }

  public nodeToSchemaOutput<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output
  >(node: BlueNode, schema: ZodType<Output, Def, Input>): Output {
    const converter = new NodeToObjectConverter(this.typeSchemaResolver);
    return converter.convert(node, schema);
  }

  public jsonValueToNode(json: JsonBlueValue) {
    return this.preprocess(NodeDeserializer.deserialize(json));
  }

  /**
   * Converts a YAML string to a BlueNode and preprocesses it
   * @param yaml - The YAML string to convert
   * @returns The preprocessed BlueNode
   */
  public yamlToNode(yaml: string) {
    const json = yamlBlueParse(yaml);
    if (!json) {
      throw new Error('Failed to parse YAML to JSON');
    }
    return this.jsonValueToNode(json);
  }

  public nodeToBlueObject(node: BlueNode) {
    try {
      const jsonBlueObject = NodeToMapListOrValue.get(node);
      return blueObjectSchema.parse(jsonBlueObject);
    } catch (error) {
      throw new Error(`Failed transforming BlueNode to BlueObject: ${error}`);
    }
  }

  public jsonValueToBlueObject(json: JsonBlueValue) {
    const node = this.jsonValueToNode(json);
    return this.nodeToBlueObject(node);
  }

  public yamlToBlueObject(yaml: string) {
    const node = this.yamlToNode(yaml);
    return this.nodeToBlueObject(node);
  }

  public calculateBlueId(value: JsonBlueValue) {
    return calculateBlueId(value);
  }

  public calculateBlueIdSync(value: JsonBlueValue) {
    return calculateBlueIdSync(value);
  }

  /**
   * Adds preprocessing aliases to the map
   * @param aliases - A map of aliases to add
   */
  public addPreprocessingAliases(aliases: Map<string, string>): void {
    // Merge the maps
    aliases.forEach((value, key) => {
      this.preprocessingAliases.set(key, value);
    });
  }

  /**
   * Preprocesses a node
   * @param node - The node to preprocess
   * @returns The preprocessed node
   */
  public preprocess(node: BlueNode): BlueNode {
    const blueNode = node.getBlue();
    if (blueNode && typeof blueNode.getValue() === 'string') {
      const blueValue = blueNode.getValue() as string;

      if (this.preprocessingAliases.has(blueValue)) {
        const clonedNode = node.clone();
        clonedNode.setBlue(
          new BlueNode().setBlueId(this.preprocessingAliases.get(blueValue))
        );
        return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
          clonedNode
        );
      } else if (BlueIds.isPotentialBlueId(blueValue)) {
        const clonedNode = node.clone();
        clonedNode.setBlue(new BlueNode().setBlueId(blueValue));
        return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
          clonedNode
        );
      } else {
        throw new Error(`Invalid blue value: ${blueValue}`);
      }
    }

    return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(node);
  }

  public getNodeProvider(): NodeProvider {
    return this.nodeProvider;
  }

  public setNodeProvider(nodeProvider: NodeProvider): Blue {
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
    return this;
  }

  public getTypeSchemaResolver(): TypeSchemaResolver | null {
    return this.typeSchemaResolver;
  }

  public setTypeSchemaResolver(
    typeSchemaResolver: TypeSchemaResolver | null
  ): Blue {
    this.typeSchemaResolver = typeSchemaResolver;
    return this;
  }

  /**
   * Gets the preprocessing aliases
   * @returns The preprocessing aliases map
   */
  public getPreprocessingAliases(): Map<string, string> {
    return this.preprocessingAliases;
  }

  /**
   * Sets the preprocessing aliases
   * @param aliases - The preprocessing aliases to set
   * @returns This Blue instance
   */
  public setPreprocessingAliases(aliases: Map<string, string>): Blue {
    this.preprocessingAliases = aliases;
    return this;
  }
}
