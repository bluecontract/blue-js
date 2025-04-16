import { blueObjectSchema, JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { NodeProvider, createNodeProvider } from './NodeProvider';
import { NodeToMapListOrValue, TypeSchemaResolver } from './utils';
import { NodeProviderWrapper } from './utils/NodeProviderWrapper';
import { ZodTypeDef, ZodType } from 'zod';
import { calculateBlueId, calculateBlueIdSync, yamlBlueParse } from '../utils';

export class Blue {
  private nodeProvider: NodeProvider;
  private typeSchemaResolver: TypeSchemaResolver | null;

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
    return NodeDeserializer.deserialize(json);
  }

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
}
