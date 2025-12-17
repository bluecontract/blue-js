import { JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { ResolvedBlueNode } from './model/ResolvedNode';
import { NodeProvider, createNodeProvider } from './NodeProvider';
import {
  BlueIdCalculator,
  NodeToMapListOrValue,
  NodeTransformer,
  NodeTypeMatcher,
  TypeSchemaResolver,
} from './utils';
import { NodeToYaml } from './utils/NodeToYaml';
import { BlueNodeTypeSchema } from './utils/TypeSchema';
import { NodeProviderWrapper } from './utils/NodeProviderWrapper';
import { ZodTypeDef, ZodType, AnyZodObject } from 'zod';
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
import { Limits, NO_LIMITS } from './utils/limits';
import { NodeExtender } from './utils/NodeExtender';
import { AnyBlueRepository } from './types/BlueRepository';
import { Merger } from './merge/Merger';
import { MergingProcessor } from './merge/MergingProcessor';
import { createDefaultMergingProcessor } from './merge';
import { MergeReverser } from './utils/MergeReverser';
import { CompositeLimits } from './utils/limits';
import { InlineTypeRestorer } from './utils/InlineTypeRestorer';
import { RepositoryRegistry } from './repository/RepositoryRuntime';
import { RepositoryVersionSerializer } from './utils/RepositoryVersionSerializer';
import { BlueError, BlueErrorCode } from './errors/BlueError';
import { normalizeBlueContextRepositories } from './utils/BlueContextRepositoriesParser';
import {
  BlueContext,
  NodeToJsonFormat,
  NodeToJsonOptions,
} from './types/BlueContext';
import { ReplaceInlineValuesForTypeAttributesWithImports } from './preprocess/processor';

export type { AnyBlueRepository, BlueRepository } from './types/BlueRepository';

export interface BlueOptions {
  nodeProvider?: NodeProvider;
  typeSchemaResolver?: TypeSchemaResolver;
  urlFetchStrategy?: UrlFetchStrategy;
  repositories?: AnyBlueRepository[];
  mergingProcessor?: MergingProcessor;
}

export class Blue {
  private nodeProvider: NodeProvider;
  private typeSchemaResolver: TypeSchemaResolver | null;
  private blueDirectivePreprocessor: BlueDirectivePreprocessor;
  private urlContentFetcher: UrlContentFetcher;
  private blueIdsMappingGenerator: BlueIdsMappingGenerator;
  private globalLimits = NO_LIMITS;
  private mergingProcessor: MergingProcessor;
  private repositories?: AnyBlueRepository[];
  private repositoryRegistry: RepositoryRegistry;

  constructor(options: BlueOptions = {}) {
    const {
      nodeProvider,
      typeSchemaResolver = null,
      urlFetchStrategy,
      repositories,
      mergingProcessor,
    } = options;

    // Store repositories for later use in setNodeProvider
    this.repositories = repositories;
    this.repositoryRegistry = new RepositoryRegistry(repositories ?? []);

    // Use NodeProviderWrapper to create the provider chain with repositories
    const defaultProvider = createNodeProvider(() => []);
    this.nodeProvider = NodeProviderWrapper.wrap(
      nodeProvider || defaultProvider,
      repositories,
      { toCurrentBlueId: this.toCurrentBlueId.bind(this) },
    );

    this.typeSchemaResolver =
      typeSchemaResolver ??
      new TypeSchemaResolver([], {
        nodeProvider: this.nodeProvider,
        toCurrentBlueId: this.toCurrentBlueId.bind(this),
      });
    this.typeSchemaResolver?.setNodeProvider(this.nodeProvider);
    this.mergingProcessor = mergingProcessor ?? createDefaultMergingProcessor();

    this.urlContentFetcher = new UrlContentFetcher(urlFetchStrategy);
    this.blueDirectivePreprocessor = new BlueDirectivePreprocessor(
      undefined,
      this.urlContentFetcher,
    );

    this.blueIdsMappingGenerator = new BlueIdsMappingGenerator();
    this.blueIdsMappingGenerator.registerBlueIds(
      this.repositoryRegistry.getAliases(),
    );

    const schemasToRegister = this.repositoryRegistry
      .getRuntimes()
      .flatMap((runtime) => runtime.schemas);
    if (schemasToRegister.length > 0) {
      this.typeSchemaResolver?.registerSchemas(schemasToRegister);
    }
  }

  /**
   * Converts a BlueNode to a JSON representation based on the specified strategy.
   *
   * @param node - The BlueNode to convert.
   * @param strategyOrOptions - The conversion strategy or options to use. See {@link NodeToMapListOrValue.get} for detailed strategy descriptions.
   * @returns A JSON representation of the node.
   */
  public nodeToJson(
    node: BlueNode,
    strategyOrOptions:
      | Parameters<typeof NodeToMapListOrValue.get>[1]
      | NodeToJsonOptions = 'official',
  ) {
    const options = this.normalizeNodeToJsonOptions(strategyOrOptions);
    const targetNode = options.blueContext
      ? this.transformForBlueContext(node, options.blueContext)
      : node;
    return NodeToMapListOrValue.get(targetNode, options.format);
  }

  /**
   * Converts a BlueNode to a deterministic YAML string. Uses nodeToJson under the hood
   * and then applies stable key ordering (Blue fields first, then alpha) before dumping.
   */
  public nodeToYaml(
    node: BlueNode,
    strategy:
      | Parameters<typeof NodeToMapListOrValue.get>[1]
      | NodeToJsonOptions = 'official',
  ) {
    const options = this.normalizeNodeToJsonOptions(strategy);
    const targetNode = options.blueContext
      ? this.transformForBlueContext(node, options.blueContext)
      : node;
    return NodeToYaml.get(targetNode, { strategy: options.format });
  }

  public nodeToSchemaOutput<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output,
  >(node: BlueNode, schema: ZodType<Output, Def, Input>): Output {
    const converter = new NodeToObjectConverter(this.typeSchemaResolver);
    return converter.convert(node, schema);
  }

  public resolve(node: BlueNode, limits: Limits = NO_LIMITS): ResolvedBlueNode {
    const effectiveLimits = this.combineWithGlobalLimits(limits);
    const merger = new Merger(this.mergingProcessor, this.nodeProvider);
    return merger.resolve(node, effectiveLimits);
  }

  /**
   * Wraps an already resolved (merged) BlueNode in a ResolvedBlueNode.
   * Useful when you persist a resolved node (e.g., in a database) and later
   * need a ResolvedBlueNode instance again.
   * Note: This does not resolve the node; it assumes the input is already resolved.
   * @param resolvedNode A BlueNode that has already been resolved (merged).
   * @returns A new ResolvedBlueNode instance.
   */
  public createResolvedNode(resolvedNode: BlueNode): ResolvedBlueNode {
    if (resolvedNode instanceof ResolvedBlueNode) {
      return resolvedNode;
    }
    return new ResolvedBlueNode(resolvedNode);
  }

  public reverse(node: BlueNode) {
    const reverser = new MergeReverser();
    return reverser.reverse(node);
  }

  /**
   * Returns a copy of the provided node with any referenced types converted back to their
   * inline representations (e.g. `Text`, `Dictionary`).
   *
   * The original node remains unchanged; the transformation relies on registered BlueIds and
   * repository-backed definitions currently known to this {@link Blue} instance.
   */
  public restoreInlineTypes(node: BlueNode): BlueNode {
    const restorer = new InlineTypeRestorer({
      nodeProvider: this.nodeProvider,
      blueIdsMappingGenerator: this.blueIdsMappingGenerator,
    });
    return restorer.restore(node);
  }

  public extend(node: BlueNode, limits: Limits) {
    const effectiveLimits = this.combineWithGlobalLimits(limits);
    new NodeExtender(this.nodeProvider).extend(node, effectiveLimits);
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
    value: JsonBlueValue | BlueNode | BlueNode[],
  ): Promise<BlueNode | BlueNode[]> => {
    if (
      value instanceof BlueNode ||
      (Array.isArray(value) && value.every((v) => v instanceof BlueNode))
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      const nodes = await Promise.all(
        value.map((v) => this.jsonValueToNodeAsync(v)),
      );
      return nodes;
    }

    return this.jsonValueToNodeAsync(value);
  };

  public calculateBlueId = async (
    value: JsonBlueValue | BlueNode | BlueNode[],
  ) => {
    const prepared = await this.prepareForBlueIdCalculation(value);
    return BlueIdCalculator.calculateBlueId(prepared);
  };

  private prepareForBlueIdCalculationSync = (
    value: JsonBlueValue | BlueNode | BlueNode[],
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
    const aliasReplaced = this.replaceInlineTypeAliases(preprocessedNode);
    const processed = new Preprocessor({
      nodeProvider: this.nodeProvider,
    }).preprocessWithDefaultBlue(aliasReplaced);
    return this.normalizeHistoricalBlueIds(processed);
  }

  public async preprocessAsync(node: BlueNode): Promise<BlueNode> {
    const preprocessedNode =
      await this.blueDirectivePreprocessor.processAsync(node);
    const aliasReplaced = this.replaceInlineTypeAliases(preprocessedNode);
    const processed = new Preprocessor({
      nodeProvider: this.nodeProvider,
    }).preprocessWithDefaultBlue(aliasReplaced);
    return this.normalizeHistoricalBlueIds(processed);
  }

  public transform(
    node: BlueNode,
    transformer: (node: BlueNode) => BlueNode,
  ): BlueNode {
    return NodeTransformer.transform(node, transformer);
  }

  public getNodeProvider(): NodeProvider {
    return this.nodeProvider;
  }

  public setNodeProvider(nodeProvider: NodeProvider): Blue {
    this.nodeProvider = NodeProviderWrapper.wrap(
      nodeProvider,
      this.repositories,
      { toCurrentBlueId: this.toCurrentBlueId.bind(this) },
    );
    this.typeSchemaResolver?.setNodeProvider(this.nodeProvider);
    return this;
  }

  public getTypeSchemaResolver(): TypeSchemaResolver | null {
    return this.typeSchemaResolver;
  }

  public setTypeSchemaResolver(
    typeSchemaResolver: TypeSchemaResolver | null,
  ): Blue {
    this.typeSchemaResolver = typeSchemaResolver;
    this.typeSchemaResolver?.setNodeProvider(this.nodeProvider);
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

  /**
   * Checks if a BlueNode is of a specific type schema.
   *
   * @param node - The BlueNode to check
   * @param schema - The Zod schema to check against
   * @param options - Optional configuration
   * @returns true if the node matches the schema type, false otherwise
   */
  public isTypeOf(
    node: BlueNode,
    schema: AnyZodObject,
    options?: {
      checkSchemaExtensions?: boolean;
    },
  ): boolean {
    return BlueNodeTypeSchema.isTypeOf(node, schema, {
      checkSchemaExtensions: options?.checkSchemaExtensions,
      typeSchemaResolver: this.typeSchemaResolver,
    });
  }

  /**
   * Checks if a BlueNode matches a BlueNode type.
   *
   * @param node - The BlueNode to check.
   * @param type - The BlueNode type to check against.
   * @returns true if the node matches the type, false otherwise.
   */
  public isTypeOfNode(node: BlueNode, type: BlueNode) {
    return new NodeTypeMatcher(this).matchesType(node, type, this.globalLimits);
  }

  /**
   * Sets the global limits for this Blue instance.
   * These limits will be combined with method-specific limits when resolving or extending nodes.
   *
   * @param globalLimits - The global limits to set, or null to use NO_LIMITS
   * @returns This instance for chaining
   */
  public setGlobalLimits(globalLimits: Limits | null): Blue {
    this.globalLimits = globalLimits ?? NO_LIMITS;
    return this;
  }

  /**
   * Gets the current global limits for this Blue instance.
   *
   * @returns The current global limits
   */
  public getGlobalLimits(): Limits {
    return this.globalLimits;
  }

  public toCurrentBlueId(blueId: string): string {
    return this.repositoryRegistry?.toCurrentBlueId(blueId) ?? blueId;
  }

  private normalizeHistoricalBlueIds(node: BlueNode): BlueNode {
    return NodeTransformer.transform(node, (current) => {
      this.normalizeTypeField(
        current,
        () => current.getType(),
        (value) => current.setType(value),
      );
      this.normalizeTypeField(
        current,
        () => current.getItemType(),
        (value) => current.setItemType(value),
      );
      this.normalizeTypeField(
        current,
        () => current.getKeyType(),
        (value) => current.setKeyType(value),
      );
      this.normalizeTypeField(
        current,
        () => current.getValueType(),
        (value) => current.setValueType(value),
      );
      return current;
    });
  }

  private normalizeTypeField(
    node: BlueNode,
    getter: () => BlueNode | undefined,
    setter: (value: BlueNode | undefined) => void,
  ) {
    const typeNode = getter();
    if (!typeNode || typeNode.isInlineValue()) {
      return;
    }
    const blueId = typeNode.getBlueId();
    if (!blueId) {
      return;
    }
    const mapped = this.toCurrentBlueId(blueId);
    if (mapped !== blueId) {
      setter(typeNode.clone().setBlueId(mapped));
    }
  }

  private normalizeNodeToJsonOptions(
    strategyOrOptions:
      | Parameters<typeof NodeToMapListOrValue.get>[1]
      | NodeToJsonOptions,
  ): { format: NodeToJsonFormat; blueContext?: BlueContext } {
    if (typeof strategyOrOptions === 'string') {
      return { format: strategyOrOptions, blueContext: undefined };
    }

    return {
      format: strategyOrOptions?.format ?? 'official',
      blueContext: strategyOrOptions?.blueContext,
    };
  }

  private transformForBlueContext(
    node: BlueNode,
    blueContext: BlueContext,
  ): BlueNode {
    const targetRepoVersionIndexes =
      this.computeTargetRepoVersionIndexes(blueContext);

    if (Object.keys(targetRepoVersionIndexes).length === 0) {
      return node;
    }

    const normalized = this.normalizeHistoricalBlueIds(node);

    const serializer = new RepositoryVersionSerializer({
      registry: this.repositoryRegistry,
      targetRepoVersionIndexes,
      fallbackToCurrentInlineDefinitions:
        blueContext.fallbackToCurrentInlineDefinitions !== false,
    });

    return serializer.transform(normalized);
  }

  private computeTargetRepoVersionIndexes(
    blueContext: BlueContext | undefined,
  ): Record<string, number> {
    const result: Record<string, number> = {};

    if (!blueContext?.repositories) {
      return result;
    }

    const repositories =
      typeof blueContext.repositories === 'string'
        ? normalizeBlueContextRepositories(blueContext.repositories)
        : blueContext.repositories;
    for (const [repoName, repoBlueId] of Object.entries(repositories)) {
      const runtime = this.repositoryRegistry.findRuntimeByName(repoName);
      if (!runtime) {
        continue;
      }
      const index = runtime.repoVersionIndexById[repoBlueId];
      if (index === undefined) {
        throw this.unknownRepoBlueIdError(
          repoName,
          repoBlueId,
          runtime.currentRepoBlueId,
        );
      }
      result[repoName] = index;
    }

    return result;
  }

  private unknownRepoBlueIdError(
    repoName: string,
    requestedRepoBlueId: string,
    serverRepoBlueId: string,
  ): BlueError {
    const message = `Unknown RepoBlueId '${requestedRepoBlueId}' for repository '${repoName}'.`;
    const detail = {
      code: BlueErrorCode.REPO_UNKNOWN_REPO_BLUE_ID,
      severity: 'error' as const,
      message,
      locationPath: [],
      context: {
        repoName,
        requestedRepoBlueId,
        serverRepoBlueId,
      },
    };
    return new BlueError(BlueErrorCode.REPO_UNKNOWN_REPO_BLUE_ID, message, [
      detail,
    ]);
  }

  private combineWithGlobalLimits(methodLimits: Limits) {
    if (this.globalLimits == NO_LIMITS) {
      return methodLimits;
    }

    if (methodLimits == NO_LIMITS) {
      return this.globalLimits;
    }

    return CompositeLimits.of(this.globalLimits, methodLimits);
  }

  private replaceInlineTypeAliases(node: BlueNode): BlueNode {
    const mappings = new Map<string, string>(
      Object.entries(this.blueIdsMappingGenerator.getAllBlueIds()),
    );

    const preprocessingAliases =
      this.blueDirectivePreprocessor.getPreprocessingAliases();
    preprocessingAliases.forEach((value, key) => {
      mappings.set(key, value);
    });

    if (mappings.size === 0) {
      return node;
    }

    return new ReplaceInlineValuesForTypeAttributesWithImports(
      mappings,
    ).process(node);
  }
}
