import { PreloadedNodeProvider } from './PreloadedNodeProvider';
import { NodeContentHandler } from './NodeContentHandler';
import { BlueNode, NodeDeserializer } from '../model';
import { JsonBlueValue } from '../../schema';
import { BlueRepository } from '../types/BlueRepository';
import { Preprocessor } from '../preprocess/Preprocessor';
import { BlueIdsMappingGenerator } from '../preprocess/utils/BlueIdsMappingGenerator';
import { BlueError, BlueErrorCode } from '../errors/BlueError';

/**
 * A NodeProvider that processes content from BlueRepository definitions.
 * Similar to Java's ClasspathBasedNodeProvider but for repository content.
 */
export class RepositoryBasedNodeProvider extends PreloadedNodeProvider {
  private blueIdToContentMap: Map<string, JsonBlueValue> = new Map();
  private blueIdToMultipleDocumentsMap: Map<string, boolean> = new Map();
  private readonly preprocessor: (node: BlueNode) => BlueNode;

  constructor(repositories: BlueRepository[]) {
    super();

    const blueIdsMappingGenerator = new BlueIdsMappingGenerator();
    const aliasMappings =
      RepositoryBasedNodeProvider.collectAliasMappings(repositories);
    if (Object.keys(aliasMappings).length > 0) {
      blueIdsMappingGenerator.registerBlueIds(aliasMappings);
    }

    const defaultPreprocessor = new Preprocessor({
      nodeProvider: this,
      blueIdsMappingGenerator,
    });
    this.preprocessor = (node: BlueNode) =>
      defaultPreprocessor.preprocessWithDefaultBlue(node);

    // Process all repository contents
    this.loadRepositories(repositories);
  }

  private static collectAliasMappings(
    repositories: BlueRepository[],
  ): Record<string, string> {
    const aliases: Record<string, string> = {};
    for (const repository of repositories) {
      for (const pkg of Object.values(repository.packages)) {
        for (const [alias, blueId] of Object.entries(pkg.aliases)) {
          const existing = aliases[alias];
          if (existing && existing !== blueId) {
            throw new Error(`Conflicting alias mapping for ${alias}`);
          }
          aliases[alias] = blueId;
        }
      }
    }
    return aliases;
  }

  private loadRepositories(repositories: BlueRepository[]): void {
    for (const repository of repositories) {
      Object.values(repository.packages).forEach((pkg) => {
        for (const [providedBlueId, content] of Object.entries(pkg.contents)) {
          this.processContent(content, providedBlueId);
        }
      });
    }
  }

  private processContent(
    content: JsonBlueValue,
    providedBlueId?: string,
  ): void {
    if (Array.isArray(content)) {
      this.processMultipleDocuments(content, providedBlueId);
    } else {
      this.processSingleDocument(content, providedBlueId);
    }
  }

  private processSingleDocument(
    content: JsonBlueValue,
    providedBlueId?: string,
  ): void {
    const node = NodeDeserializer.deserialize(content);
    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNode(
      node,
      this.preprocessor,
    );

    const blueId = this.resolveProvidedBlueId(
      parsedContent.blueId,
      providedBlueId,
    );
    this.blueIdToContentMap.set(blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(blueId, false);

    const nodeName = node.getName();
    if (nodeName) {
      this.addToNameMap(nodeName, blueId);
    }
  }

  private processMultipleDocuments(
    contents: JsonBlueValue[],
    providedBlueId?: string,
  ): void {
    const nodes = contents.map((item) => {
      const node = NodeDeserializer.deserialize(item);
      return this.preprocessor(node);
    });

    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNodeList(
      nodes,
      (node) => node,
    );

    const blueId = this.resolveProvidedBlueId(
      parsedContent.blueId,
      providedBlueId,
    );
    this.blueIdToContentMap.set(blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(blueId, true);

    nodes.forEach((node, index) => {
      const itemBlueId = `${blueId}#${index}`;
      const itemParsedContent =
        NodeContentHandler.parseAndCalculateBlueIdForNode(node, (n) => n);
      this.blueIdToContentMap.set(
        itemParsedContent.blueId,
        itemParsedContent.content,
      );
      this.blueIdToMultipleDocumentsMap.set(itemParsedContent.blueId, false);

      const nodeName = node.getName();
      if (nodeName) {
        this.addToNameMap(nodeName, itemBlueId);
      }
    });
  }

  protected override fetchContentByBlueId(
    baseBlueId: string,
  ): JsonBlueValue | null {
    const content = this.blueIdToContentMap.get(baseBlueId);
    const isMultipleDocuments =
      this.blueIdToMultipleDocumentsMap.get(baseBlueId);

    if (content !== undefined && isMultipleDocuments !== undefined) {
      return NodeContentHandler.resolveThisReferences(
        content,
        baseBlueId,
        isMultipleDocuments,
      );
    }

    return null;
  }

  /**
   * Get all stored Blue IDs
   */
  public getBlueIds(): string[] {
    return Array.from(this.blueIdToContentMap.keys());
  }

  /**
   * Check if a Blue ID exists in this provider
   */
  public hasBlueId(blueId: string): boolean {
    const baseBlueId = blueId.split('#')[0];
    return this.blueIdToContentMap.has(baseBlueId);
  }

  private resolveProvidedBlueId(
    computedBlueId: string,
    providedBlueId?: string,
  ): string {
    if (providedBlueId === undefined) {
      return computedBlueId;
    }

    if (providedBlueId !== computedBlueId) {
      throw new BlueError(
        BlueErrorCode.BLUE_ID_MISMATCH,
        `Provided BlueId '${providedBlueId}' does not match computed BlueId '${computedBlueId}'.`,
        [
          {
            code: BlueErrorCode.BLUE_ID_MISMATCH,
            message:
              'Repository content BlueId does not match its computed semantic storage identity.',
            context: { providedBlueId, computedBlueId },
          },
        ],
      );
    }

    return providedBlueId;
  }
}
