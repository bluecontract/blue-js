import { BlueNode, NodeDeserializer } from '../model';
import { isUrl } from '../../utils/url';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { JsonBlueValue } from '../../schema';

type UrlFetchResult = {
  data: string;
  contentType: string;
};

export interface UrlFetchStrategy {
  fetchUrl(url: string): Promise<UrlFetchResult>;
}

const DefaultUrlFetchStrategy: UrlFetchStrategy = {
  fetchUrl: async (url: string) => {
    throw new Error(
      `You must provide a custom UrlFetchStrategy to fetch content from URL: ${url}`
    );
  },
};

export class UrlContentFetcher {
  // Cache to avoid repeated network requests for the same URL
  private cache: Map<string, BlueNode[]> = new Map();
  private fetchStrategy: UrlFetchStrategy;
  private enabled = false;
  private allowedDomains: string[] = [];

  constructor(fetchStrategy?: UrlFetchStrategy) {
    this.fetchStrategy = fetchStrategy || DefaultUrlFetchStrategy;
  }

  public validateUrl(url: string): boolean {
    if (!isUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }
    return true;
  }

  public isDomainAllowed(url: string): boolean {
    if (this.allowedDomains.length === 0) {
      return true;
    }

    try {
      const urlObj = new URL(url);
      return this.allowedDomains.some(
        (domain) =>
          urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  public getFromCache(url: string): BlueNode[] {
    try {
      this.validateUrl(url);
      return this.cache.get(url) || [];
    } catch {
      return [];
    }
  }

  public async fetchAndCache(url: string): Promise<BlueNode[]> {
    this.validateUrl(url);

    if (!this.enabled) {
      throw new Error(
        `URL fetching is disabled. Enable it using the enableFetching method.`
      );
    }

    if (!this.isDomainAllowed(url)) {
      throw new Error(`Domain not allowed for URL: ${url}.`);
    }

    let urlFetchResult: UrlFetchResult;
    try {
      urlFetchResult = await this.fetchStrategy.fetchUrl(url);
    } catch (error) {
      throw new Error(`Error fetching from URL: ${url}`, { cause: error });
    }

    const { data, contentType } = urlFetchResult;
    let parsedData: JsonBlueValue | undefined;

    if (
      contentType.includes('application/json') ||
      contentType.includes('text/yaml') ||
      contentType.includes('application/yaml') ||
      contentType.includes('text/plain')
    ) {
      parsedData = yamlBlueParse(data);
    } else {
      throw new Error(`Unsupported content type from URL: ${contentType}`);
    }

    if (parsedData === undefined) {
      throw new Error(`Failed to parse content from URL: ${url}`);
    }

    let nodes: BlueNode[];
    if (Array.isArray(parsedData)) {
      nodes = parsedData.map((item) => NodeDeserializer.deserialize(item));
    } else {
      nodes = [NodeDeserializer.deserialize(parsedData)];
    }

    this.cache.set(url, nodes);
    return nodes;
  }

  public prefetchUrl(url: string, nodes: BlueNode[]): void {
    try {
      this.validateUrl(url);
      this.cache.set(url, nodes);
    } catch {
      // Silently ignore invalid URLs for prefetch
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public setFetchStrategy(fetchStrategy: UrlFetchStrategy): UrlContentFetcher {
    this.fetchStrategy = fetchStrategy;
    return this;
  }

  public getFetchStrategy(): UrlFetchStrategy {
    return this.fetchStrategy;
  }

  /**
   * Enables fetching for all URLs
   * @returns This instance for chaining
   */
  public enableFetching(): UrlContentFetcher {
    this.enabled = true;
    this.allowedDomains = [];
    return this;
  }

  /**
   * Enables fetching for specific domains only
   * @param domains Array of allowed domains
   * @returns This instance for chaining
   */
  public enableFetchingForDomains(domains: string[]): UrlContentFetcher {
    this.enabled = true;
    this.allowedDomains = [...domains];
    return this;
  }

  /**
   * Disables all URL fetching
   * @returns This instance for chaining
   */
  public disableFetching(): UrlContentFetcher {
    this.enabled = false;
    return this;
  }

  public isFetchingEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gets the list of allowed domains
   * An empty list means all domains are allowed when fetching is enabled
   * @returns Array of allowed domains
   */
  public getAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }

  /**
   * Adds a domain to the allowed domains list
   * @param domain Domain to allow
   * @returns This instance for chaining
   */
  public allowDomain(domain: string): UrlContentFetcher {
    if (!this.allowedDomains.includes(domain)) {
      this.allowedDomains.push(domain);
    }
    return this;
  }

  /**
   * Removes a domain from the allowed domains list
   * @param domain Domain to disallow
   * @returns This instance for chaining
   */
  public disallowDomain(domain: string): UrlContentFetcher {
    this.allowedDomains = this.allowedDomains.filter((d) => d !== domain);
    return this;
  }

  /**
   * Clears all allowed domains, meaning all domains will be allowed when fetching is enabled
   * @returns This instance for chaining
   */
  public clearAllowedDomains(): UrlContentFetcher {
    this.allowedDomains = [];
    return this;
  }
}
