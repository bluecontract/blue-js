import { BlueNode } from '../model';
import { BlueIds } from '../utils';
import { isUrl } from '../../utils/url';
import { UrlContentFetcher } from '../provider/UrlContentFetcher';

/**
 * A preprocessor specifically for handling blue directives before main preprocessing
 */
export class BlueDirectivePreprocessor {
  private preprocessingAliases: Map<string, string> = new Map();
  private urlContentFetcher?: UrlContentFetcher;

  /**
   * Creates a new BlueDirectivePreprocessor
   *
   * @param preprocessingAliases - Map of alias values to BlueIds (optional)
   * @param urlContentFetcher - UrlContentFetcher for fetching URL content
   */
  constructor(
    preprocessingAliases?: Map<string, string>,
    urlContentFetcher?: UrlContentFetcher,
  ) {
    if (preprocessingAliases) {
      this.preprocessingAliases = new Map(preprocessingAliases);
    }
    this.urlContentFetcher = urlContentFetcher;
  }

  /**
   * Processes a node's blue directive synchronously
   *
   * @param node - The node to process
   * @returns The node with processed blue directive
   */
  public process(node: BlueNode): BlueNode {
    const blueNodeValue = this.getBlueNodeValue(node);

    if (blueNodeValue) {
      const clonedNode = node.clone();

      if (this.preprocessingAliases.has(blueNodeValue)) {
        return this.handleAliasValue(clonedNode, blueNodeValue);
      } else if (BlueIds.isPotentialBlueId(blueNodeValue)) {
        return this.handleBlueId(clonedNode, blueNodeValue);
      } else if (isUrl(blueNodeValue)) {
        throw new Error(
          `URL '${blueNodeValue}' detected. Use the async version of this method to fetch the content.`,
        );
      } else {
        throw new Error(`Invalid blue value: ${blueNodeValue}`);
      }
    }

    return node;
  }

  /**
   * Processes a node's blue directive asynchronously, with support for URL fetching
   *
   * @param node - The node to process
   * @returns Promise that resolves to the node with processed blue directive
   */
  public async processAsync(node: BlueNode): Promise<BlueNode> {
    const blueNodeValue = this.getBlueNodeValue(node);

    if (blueNodeValue) {
      const clonedNode = node.clone();

      if (this.preprocessingAliases.has(blueNodeValue)) {
        return this.handleAliasValue(clonedNode, blueNodeValue);
      } else if (BlueIds.isPotentialBlueId(blueNodeValue)) {
        return this.handleBlueId(clonedNode, blueNodeValue);
      } else if (isUrl(blueNodeValue) && this.urlContentFetcher) {
        try {
          const urlNodes = await this.fetchFromUrl(blueNodeValue);
          if (urlNodes) {
            clonedNode.setBlue(new BlueNode().setItems(urlNodes));
          }
          return clonedNode;
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(
              `Failed to fetch from URL '${blueNodeValue}'.\n${error.message}`,
            );
          }
          throw error;
        }
      } else if (isUrl(blueNodeValue)) {
        throw new Error(
          `UrlContentFetcher not provided for URL: ${blueNodeValue}`,
        );
      } else {
        throw new Error(`Invalid blue value: ${blueNodeValue}`);
      }
    }

    return node;
  }

  /**
   * Gets the blue node value if it exists and is a string
   * @param node - The node to get the blue value from
   * @returns The blue node value or null if it doesn't exist or isn't a string
   */
  private getBlueNodeValue(node: BlueNode): string | null {
    const blueNode = node.getBlue();
    const blueNodeValue = blueNode?.getValue();
    return blueNodeValue && typeof blueNodeValue === 'string'
      ? blueNodeValue
      : null;
  }

  /**
   * Handles a blue value that is an alias
   * @param node - The cloned node to modify
   * @param value - The alias value
   * @returns The modified node
   */
  private handleAliasValue(node: BlueNode, value: string): BlueNode {
    node.setBlue(
      new BlueNode().setBlueId(this.preprocessingAliases.get(value)),
    );
    return node;
  }

  /**
   * Handles a blue value that is a potential BlueId
   * @param node - The cloned node to modify
   * @param value - The BlueId value
   * @returns The modified node
   */
  private handleBlueId(node: BlueNode, value: string): BlueNode {
    node.setBlue(new BlueNode().setBlueId(value));
    return node;
  }

  /**
   * Fetches content from a URL
   * @param url - The URL to fetch from
   * @returns Promise that resolves to the fetched BlueNodes or null if fetch fails
   */
  private async fetchFromUrl(url: string): Promise<BlueNode[]> {
    if (!this.urlContentFetcher) {
      throw new Error(`UrlContentFetcher not provided for URL: ${url}`);
    }

    return await this.urlContentFetcher.fetchAndCache(url);
  }

  /**
   * Gets the current preprocessing aliases
   * @returns Map of aliases to BlueIds
   */
  public getPreprocessingAliases(): Map<string, string> {
    return new Map(this.preprocessingAliases);
  }

  /**
   * Sets the preprocessing aliases
   * @param aliases - Map of aliases to set
   * @returns this instance for chaining
   */
  public setPreprocessingAliases(
    aliases: Map<string, string>,
  ): BlueDirectivePreprocessor {
    this.preprocessingAliases = new Map(aliases);
    return this;
  }

  /**
   * Adds preprocessing aliases to the map
   * @param aliases - Map of aliases to add
   * @returns this instance for chaining
   */
  public addPreprocessingAliases(
    aliases: Map<string, string>,
  ): BlueDirectivePreprocessor {
    aliases.forEach((value, key) => {
      this.preprocessingAliases.set(key, value);
    });
    return this;
  }

  /**
   * Updates the URL content fetcher
   * @param urlContentFetcher - The UrlContentFetcher to use
   * @returns this instance for chaining
   */
  public setUrlContentFetcher(
    urlContentFetcher: UrlContentFetcher,
  ): BlueDirectivePreprocessor {
    this.urlContentFetcher = urlContentFetcher;
    return this;
  }

  /**
   * Gets the current URL content fetcher
   * @returns The current UrlContentFetcher or undefined
   */
  public getUrlContentFetcher(): UrlContentFetcher | undefined {
    return this.urlContentFetcher;
  }
}
