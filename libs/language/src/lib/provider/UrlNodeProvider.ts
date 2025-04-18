import { NodeProvider } from '../NodeProvider';
import { BlueNode, NodeDeserializer } from '../model';
import { isUrl } from '../../utils/url';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { JsonBlueValue } from '../../schema';
import axios from 'axios';

/**
 * A NodeProvider that fetches nodes from URLs
 */
export class UrlNodeProvider extends NodeProvider {
  // Cache to avoid repeated network requests for the same URL
  private cache: Map<string, BlueNode[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Check if this provider can handle the given blueId
   * @param blueId - The potential URL to check
   */
  public canHandle(blueId: string): boolean {
    return isUrl(blueId);
  }

  /**
   * Fetches nodes from a URL
   * @param url - The URL to fetch from (used as blueId)
   * @returns Array of nodes or an empty array if fetch fails
   */
  override fetchByBlueId(url: string): BlueNode[] {
    // If we're not dealing with a URL, return empty array
    if (!this.canHandle(url)) {
      return [];
    }

    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url) || [];
    }

    // This is a synchronous method, but fetching is async
    // For now, we'll return empty and rely on the cached value on subsequent calls
    // Start the fetch in the background
    this.fetchAndCacheAsync(url);

    return [];
  }

  /**
   * Asynchronously fetches and parses content from a URL
   * @param url - The URL to fetch
   * @returns Promise that resolves when fetching and caching is complete
   */
  public async fetchAndCacheAsync(url: string): Promise<void> {
    try {
      const response = await axios.get(url, {
        responseType: 'text',
        headers: {
          Accept: 'application/json, text/yaml, application/yaml, text/plain',
        },
      });

      const contentType = response.headers['content-type'] || '';
      let data: JsonBlueValue | undefined;

      // Handle different content types
      if (contentType.includes('application/json')) {
        data = response.data;
      } else if (
        contentType.includes('text/yaml') ||
        contentType.includes('application/yaml') ||
        contentType.includes('text/plain')
      ) {
        data = yamlBlueParse(response.data);
      } else {
        console.error(`Unsupported content type from URL: ${contentType}`);
        return;
      }

      if (!data) {
        console.error(`Failed to parse content from URL: ${url}`);
        return;
      }

      // Convert to nodes
      let nodes: BlueNode[];
      if (Array.isArray(data)) {
        nodes = data.map((item) => NodeDeserializer.deserialize(item));
      } else {
        nodes = [NodeDeserializer.deserialize(data)];
      }

      // Cache the result
      this.cache.set(url, nodes);
    } catch (error) {
      console.error(`Error fetching from URL: ${url}`, error);
    }
  }

  /**
   * Prefetch and cache a URL synchronously (for testing or preloading)
   * @param url - URL to prefetch
   * @param nodes - Nodes to cache for this URL
   */
  public prefetchUrl(url: string, nodes: BlueNode[]): void {
    if (isUrl(url)) {
      this.cache.set(url, nodes);
    }
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}
