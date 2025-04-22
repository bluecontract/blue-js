import { JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { NodeProvider, createNodeProvider } from './NodeProvider';
import { TypeSchemaResolver } from './utils';
import { NodeProviderWrapper } from './utils/NodeProviderWrapper';
import { ZodTypeDef, ZodType } from 'zod';
import { calculateBlueId, calculateBlueIdSync, yamlBlueParse } from '../utils';
import { Preprocessor } from './preprocess/Preprocessor';
import { BlueDirectivePreprocessor } from './preprocess/BlueDirectivePreprocessor';
import {
  UrlContentFetcher,
  UrlFetchStrategy,
} from './provider/UrlContentFetcher';

export interface BlueOptions {
  nodeProvider?: NodeProvider;
  typeSchemaResolver?: TypeSchemaResolver;
  urlFetchStrategy?: UrlFetchStrategy;
}

export class Blue {
  private nodeProvider: NodeProvider;
  private typeSchemaResolver: TypeSchemaResolver | null;
  private blueDirectivePreprocessor: BlueDirectivePreprocessor;
  private urlContentFetcher: UrlContentFetcher;

  constructor(options: BlueOptions = {}) {
    const {
      nodeProvider,
      typeSchemaResolver = null,
      urlFetchStrategy,
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

  public async jsonValueToNodeAsync(json: JsonBlueValue): Promise<BlueNode> {
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

  public calculateBlueId(value: JsonBlueValue) {
    return calculateBlueId(value);
  }

  public calculateBlueIdSync(value: JsonBlueValue) {
    return calculateBlueIdSync(value);
  }

  public addPreprocessingAliases(aliases: Map<string, string>): void {
    this.blueDirectivePreprocessor.addPreprocessingAliases(aliases);
  }

  public preprocess(node: BlueNode): BlueNode {
    const preprocessedNode = this.blueDirectivePreprocessor.process(node);
    return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
      preprocessedNode
    );
  }

  public async preprocessAsync(node: BlueNode): Promise<BlueNode> {
    const preprocessedNode = await this.blueDirectivePreprocessor.processAsync(
      node
    );
    return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
      preprocessedNode
    );
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
}
