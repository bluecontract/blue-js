import { JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { NodeProvider, createNodeProvider } from './NodeProvider';
import { TypeSchemaResolver, BlueIds } from './utils';
import { NodeProviderWrapper } from './utils/NodeProviderWrapper';
import { ZodTypeDef, ZodType } from 'zod';
import { calculateBlueId, calculateBlueIdSync, yamlBlueParse } from '../utils';
import { Preprocessor } from './preprocess/Preprocessor';
import { isUrl } from '../utils/url';
import { UrlNodeProvider } from './provider/UrlNodeProvider';

export class Blue {
  private nodeProvider: NodeProvider;
  private typeSchemaResolver: TypeSchemaResolver | null;
  private preprocessingAliases: Map<string, string> = new Map();
  private urlNodeProvider: UrlNodeProvider;

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

    // Initialize URL node provider for use in preprocess method
    this.urlNodeProvider = new UrlNodeProvider();

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

  /**
   * Converts JSON to node and preprocesses it
   * @param json - The JSON value to convert
   * @returns The preprocessed BlueNode
   */
  public jsonValueToNode(json: JsonBlueValue) {
    return this.preprocess(NodeDeserializer.deserialize(json));
  }

  /**
   * Asynchronously converts JSON to node and preprocesses it
   * @param json - The JSON value to convert
   * @returns Promise that resolves to the preprocessed BlueNode
   */
  public async jsonValueToNodeAsync(json: JsonBlueValue): Promise<BlueNode> {
    return this.preprocessAsync(NodeDeserializer.deserialize(json));
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

  /**
   * Asynchronously converts a YAML string to a BlueNode and preprocesses it
   * @param yaml - The YAML string to convert
   * @returns Promise that resolves to the preprocessed BlueNode
   */
  public async yamlToNodeAsync(yaml: string): Promise<BlueNode> {
    const json = yamlBlueParse(yaml);
    if (!json) {
      throw new Error('Failed to parse YAML to JSON');
    }
    return this.jsonValueToNodeAsync(json);
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
    const blueNodeValue = blueNode?.getValue();
    if (blueNodeValue && typeof blueNodeValue === 'string') {
      const clonedNode = node.clone();

      if (this.preprocessingAliases.has(blueNodeValue)) {
        clonedNode.setBlue(
          new BlueNode().setBlueId(this.preprocessingAliases.get(blueNodeValue))
        );
        return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
          clonedNode
        );
      } else if (isUrl(blueNodeValue)) {
        throw new Error(
          `URL '${blueNodeValue}' detected. Use the async version of this method to fetch the content.`
        );
      } else if (BlueIds.isPotentialBlueId(blueNodeValue)) {
        clonedNode.setBlue(new BlueNode().setBlueId(blueNodeValue));
        return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
          clonedNode
        );
      } else {
        throw new Error(`Invalid blue value: ${blueNodeValue}`);
      }
    }

    return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(node);
  }

  /**
   * Asynchronously preprocesses a node, with support for URL fetching
   * @param node - The node to preprocess
   * @returns Promise that resolves to the preprocessed node
   */
  public async preprocessAsync(node: BlueNode): Promise<BlueNode> {
    const blueNode = node.getBlue();
    const blueNodeValue = blueNode?.getValue();
    if (blueNodeValue && typeof blueNodeValue === 'string') {
      const clonedNode = node.clone();

      if (this.preprocessingAliases.has(blueNodeValue)) {
        clonedNode.setBlue(
          new BlueNode().setBlueId(this.preprocessingAliases.get(blueNodeValue))
        );
        return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
          clonedNode
        );
      } else if (BlueIds.isPotentialBlueId(blueNodeValue)) {
        clonedNode.setBlue(new BlueNode().setBlueId(blueNodeValue));
        return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
          clonedNode
        );
      } else if (isUrl(blueNodeValue)) {
        const urlNodes = await this.fetchFromUrl(blueNodeValue);
        if (urlNodes) {
          clonedNode.setBlue(new BlueNode().setItems(urlNodes));
        }

        return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
          clonedNode
        );
      } else {
        throw new Error(`Invalid blue value: ${blueNodeValue}`);
      }
    }

    return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(node);
  }

  /**
   * Fetches content from a URL
   * @param url - The URL to fetch from
   * @returns Promise that resolves to the fetched JSON data or null if fetch fails
   */
  private async fetchFromUrl(url: string): Promise<BlueNode[] | null> {
    try {
      // Use the UrlNodeProvider to load the URL content
      await this.urlNodeProvider.fetchAndCacheAsync(url);

      // Check if the content was loaded successfully
      const nodes = this.urlNodeProvider.fetchByBlueId(url);
      if (nodes && nodes.length > 0) {
        return nodes;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching from URL: ${url}`, error);
      return null;
    }
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

  public getPreprocessingAliases(): Map<string, string> {
    return this.preprocessingAliases;
  }

  public setPreprocessingAliases(aliases: Map<string, string>): Blue {
    this.preprocessingAliases = aliases;
    return this;
  }
}
