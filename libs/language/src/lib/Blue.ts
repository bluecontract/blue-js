import { JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { NodeProvider, createNodeProvider } from './NodeProvider';
import {
  BlueIdCalculator,
  NodeToMapListOrValue,
  TypeSchemaResolver,
} from './utils';
import { NodeProviderWrapper } from './utils/NodeProviderWrapper';
import { ZodTypeDef, ZodType, ZodTypeAny } from 'zod';
import { yamlBlueParse } from '../utils';
import { Preprocessor } from './preprocess/Preprocessor';
import { BlueDirectivePreprocessor } from './preprocess/BlueDirectivePreprocessor';
import {
  UrlContentFetcher,
  UrlFetchStrategy,
} from './provider/UrlContentFetcher';
import {
  BlueIdsMappingGenerator,
  BlueIdsRecord,
} from './preprocess/utils/BlueIdsMappingGenerator';

export interface BlueRepository {
  blueIds: BlueIdsRecord;
  schemas: ZodTypeAny[];
}

export interface BlueOptions {
  nodeProvider?: NodeProvider;
  typeSchemaResolver?: TypeSchemaResolver;
  urlFetchStrategy?: UrlFetchStrategy;
  repositories?: BlueRepository[];
}

export class Blue {
  private nodeProvider: NodeProvider;
  private typeSchemaResolver: TypeSchemaResolver | null;
  private blueDirectivePreprocessor: BlueDirectivePreprocessor;
  private urlContentFetcher: UrlContentFetcher;
  private blueIdsMappingGenerator: BlueIdsMappingGenerator;

  constructor(options: BlueOptions = {}) {
    const {
      nodeProvider,
      typeSchemaResolver = null,
      urlFetchStrategy,
      repositories,
    } = options;

    const defaultProvider = createNodeProvider(() => []);
    this.nodeProvider = NodeProviderWrapper.wrap(
      nodeProvider || defaultProvider
    );

    this.typeSchemaResolver = typeSchemaResolver;

    this.urlContentFetcher = new UrlContentFetcher(urlFetchStrategy);
    this.blueDirectivePreprocessor = new BlueDirectivePreprocessor(
      undefined,
      this.urlContentFetcher
    );

    this.blueIdsMappingGenerator = new BlueIdsMappingGenerator();

    if (repositories) {
      const flattenedRepositories = repositories.reduce(
        (acc, repository) => {
          acc.blueIds = { ...acc.blueIds, ...repository.blueIds };
          acc.schemas = [...acc.schemas, ...repository.schemas];
          return acc;
        },
        {
          blueIds: {} as BlueIdsRecord,
          schemas: [] as ZodTypeAny[],
        }
      );

      this.blueIdsMappingGenerator.initialize(flattenedRepositories.blueIds);
      if (!this.typeSchemaResolver) {
        this.typeSchemaResolver = new TypeSchemaResolver(
          flattenedRepositories.schemas
        );
      }
    }
  }

  /**
   * Converts a BlueNode to a JSON representation based on the specified strategy.
   *
   * @param node - The BlueNode to convert.
   * @param strategy - The conversion strategy to use. See {@link NodeToMapListOrValue.get} for detailed strategy descriptions.
   * @returns A JSON representation of the node.
   */
  public nodeToJson(
    node: BlueNode,
    strategy: Parameters<typeof NodeToMapListOrValue.get>[1] = 'official'
  ) {
    return NodeToMapListOrValue.get(node, strategy);
  }

  public nodeToSchemaOutput<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output
  >(node: BlueNode, schema: ZodType<Output, Def, Input>): Output {
    const converter = new NodeToObjectConverter(this.typeSchemaResolver);
    return converter.convert(node, schema);
  }

  public jsonValueToNode(json: unknown) {
    return this.preprocess(NodeDeserializer.deserialize(json));
  }

  public async jsonValueToNodeAsync(json: unknown): Promise<BlueNode> {
    return this.preprocessAsync(NodeDeserializer.deserialize(json));
  }

  public yamlToNode(yaml: string) {
    const json = yamlBlueParse(yaml);
    if (!json) {
      throw new Error('Failed to parse YAML to JSON');
    }
    return this.jsonValueToNode(json);
  }

  public async yamlToNodeAsync(yaml: string): Promise<BlueNode> {
    const json = yamlBlueParse(yaml);
    if (!json) {
      throw new Error('Failed to parse YAML to JSON');
    }
    return this.jsonValueToNodeAsync(json);
  }

  private prepareForBlueIdCalculation = async (
    value: JsonBlueValue | BlueNode | BlueNode[]
  ): Promise<BlueNode | BlueNode[]> => {
    if (
      value instanceof BlueNode ||
      (Array.isArray(value) && value.every((v) => v instanceof BlueNode))
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      const nodes = await Promise.all(
        value.map((v) => this.jsonValueToNodeAsync(v))
      );
      return nodes;
    }

    return this.jsonValueToNodeAsync(value);
  };

  public calculateBlueId = async (
    value: JsonBlueValue | BlueNode | BlueNode[]
  ) => {
    const prepared = await this.prepareForBlueIdCalculation(value);
    return BlueIdCalculator.calculateBlueId(prepared);
  };

  private prepareForBlueIdCalculationSync = (
    value: JsonBlueValue | BlueNode | BlueNode[]
  ): BlueNode | BlueNode[] => {
    if (
      value instanceof BlueNode ||
      (Array.isArray(value) && value.every((v) => v instanceof BlueNode))
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.jsonValueToNode(v));
    }

    return this.jsonValueToNode(value);
  };

  public calculateBlueIdSync(value: JsonBlueValue | BlueNode | BlueNode[]) {
    const prepared = this.prepareForBlueIdCalculationSync(value);
    return BlueIdCalculator.calculateBlueIdSync(prepared);
  }

  public addPreprocessingAliases(aliases: Map<string, string>): void {
    this.blueDirectivePreprocessor.addPreprocessingAliases(aliases);
  }

  public preprocess(node: BlueNode): BlueNode {
    const preprocessedNode = this.blueDirectivePreprocessor.process(node);
    return new Preprocessor({
      nodeProvider: this.nodeProvider,
      blueIdsMappingGenerator: this.blueIdsMappingGenerator,
    }).preprocessWithDefaultBlue(preprocessedNode);
  }

  public async preprocessAsync(node: BlueNode): Promise<BlueNode> {
    const preprocessedNode = await this.blueDirectivePreprocessor.processAsync(
      node
    );
    return new Preprocessor({
      nodeProvider: this.nodeProvider,
      blueIdsMappingGenerator: this.blueIdsMappingGenerator,
    }).preprocessWithDefaultBlue(preprocessedNode);
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

  public getUrlContentFetcher(): UrlContentFetcher {
    return this.urlContentFetcher;
  }

  public setUrlFetchStrategy(urlFetchStrategy: UrlFetchStrategy): Blue {
    this.urlContentFetcher.setFetchStrategy(urlFetchStrategy);
    return this;
  }

  /**
   * Enables fetching content from URLs in blue directives for all domains.
   * By default, URL fetching is disabled for security reasons.
   * This clears any domain restrictions that may have been set.
   *
   * @returns This instance for chaining
   */
  public enablePreprocessingDirectivesFetchForUrls(): Blue {
    this.urlContentFetcher.enableFetching();
    return this;
  }

  /**
   * Enables fetching content from URLs in blue directives only for specified domains.
   * By default, URL fetching is disabled for security reasons.
   *
   * @param domains Array of domains to allow (e.g. ['example.com', 'api.github.com'])
   * @returns This instance for chaining
   */
  public enablePreprocessingDirectivesFetchForDomains(domains: string[]): Blue {
    this.urlContentFetcher.enableFetchingForDomains(domains);
    return this;
  }

  /**
   * Adds a domain to the list of allowed domains for URL fetching.
   *
   * @param domain Domain to allow (e.g. 'example.com')
   * @returns This instance for chaining
   */
  public allowUrlFetchingForDomain(domain: string): Blue {
    this.urlContentFetcher.allowDomain(domain);
    return this;
  }

  /**
   * Removes a domain from the list of allowed domains for URL fetching.
   *
   * @param domain Domain to disallow
   * @returns This instance for chaining
   */
  public disallowUrlFetchingForDomain(domain: string): Blue {
    this.urlContentFetcher.disallowDomain(domain);
    return this;
  }

  /**
   * Gets the list of domains allowed for URL fetching.
   * An empty list means all domains are allowed when fetching is enabled.
   *
   * @returns Array of allowed domains
   */
  public getAllowedUrlFetchingDomains(): string[] {
    return this.urlContentFetcher.getAllowedDomains();
  }

  /**
   * Disables fetching content from URLs in blue directives.
   *
   * @returns This instance for chaining
   */
  public disablePreprocessingDirectivesFetchForUrls(): Blue {
    this.urlContentFetcher.disableFetching();
    return this;
  }

  /**
   * Checks if URL fetching is enabled for blue directives
   *
   * @returns true if URL fetching is enabled, false otherwise
   */
  public isPreprocessingDirectivesFetchForUrlsEnabled(): boolean {
    return this.urlContentFetcher.isFetchingEnabled();
  }

  public getPreprocessingAliases(): Map<string, string> {
    return this.blueDirectivePreprocessor.getPreprocessingAliases();
  }

  public setPreprocessingAliases(aliases: Map<string, string>): Blue {
    this.blueDirectivePreprocessor.setPreprocessingAliases(aliases);
    return this;
  }

  /**
   * Registers additional BlueIds collections for mapping generation
   * @param blueIdsCollections - Array of BlueIds objects to register
   * @returns This instance for chaining
   */
  public registerBlueIds(...blueIdsCollections: BlueIdsRecord[]): Blue {
    this.blueIdsMappingGenerator.registerBlueIds(...blueIdsCollections);
    return this;
  }

  /**
   * Gets all currently registered BlueIds
   * @returns Merged object containing all BlueIds from all collections
   */
  public getAllRegisteredBlueIds(): Record<string, string> {
    return this.blueIdsMappingGenerator.getAllBlueIds();
  }

  /**
   * Gets the names of all registered BlueIds
   * @returns Array of all BlueId names
   */
  public getAllBlueIdNames(): string[] {
    return this.blueIdsMappingGenerator.getAllBlueIdNames();
  }

  /**
   * Gets the BlueIdsMappingGenerator instance
   * @returns The BlueIdsMappingGenerator instance
   */
  public getBlueIdsMappingGenerator(): BlueIdsMappingGenerator {
    return this.blueIdsMappingGenerator;
  }
}
