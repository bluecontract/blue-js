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

  constructor(fetchStrategy?: UrlFetchStrategy) {
    this.fetchStrategy = fetchStrategy || DefaultUrlFetchStrategy;
  }

  public canHandleUrl(url: string): boolean {
    return isUrl(url);
  }

  public getFromCache(url: string): BlueNode[] {
    if (!this.canHandleUrl(url)) {
      return [];
    }

    return this.cache.get(url) || [];
  }

  public async fetchAndCache(url: string): Promise<BlueNode[]> {
    if (!this.canHandleUrl(url)) {
      throw new Error(`Unsupported URL: ${url}`);
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
    if (this.canHandleUrl(url)) {
      this.cache.set(url, nodes);
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
}
