import { PreloadedNodeProvider } from './PreloadedNodeProvider';
import { NodeContentHandler } from './NodeContentHandler';
import { BlueNode, NodeDeserializer } from '../model';
import { Preprocessor } from '../preprocess/Preprocessor';
import { BlueIdCalculator, NodeToMapListOrValue } from '../utils';
import { JsonBlueValue } from '../../schema';
import { BlueRepository } from '../types/BlueRepository';

/**
 * A NodeProvider that processes content from BlueRepository definitions.
 * Similar to Java's ClasspathBasedNodeProvider but for repository content.
 */
export class RepositoryBasedNodeProvider extends PreloadedNodeProvider {
  private blueIdToContentMap: Map<string, JsonBlueValue> = new Map();
  private blueIdToMultipleDocumentsMap: Map<string, boolean> = new Map();
  private preprocessor: (node: BlueNode) => BlueNode;

  constructor(repositories: BlueRepository[]) {
    super();

    // Create preprocessor with parent provider if available
    const defaultPreprocessor = new Preprocessor({ nodeProvider: this });
    this.preprocessor = (node: BlueNode) =>
      defaultPreprocessor.preprocessWithDefaultBlue(node);

    // Process all repository contents
    this.loadRepositories(repositories);
  }

  private loadRepositories(repositories: BlueRepository[]): void {
    for (const repository of repositories) {
      if (repository.contents) {
        for (const [providedBlueId, content] of Object.entries(
          repository.contents
        )) {
          this.processContent(content, providedBlueId);
        }
      }
    }
  }

  private processContent(
    content: JsonBlueValue,
    providedBlueId?: string
  ): void {
    // Check if content is an array (multiple documents)
    if (Array.isArray(content)) {
      this.processMultipleDocuments(content, providedBlueId);
    } else {
      this.processSingleDocument(content, providedBlueId);
    }
  }

  private processSingleDocument(
    content: JsonBlueValue,
    providedBlueId?: string
  ): void {
    const node = NodeDeserializer.deserialize(content);
    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNode(
      node,
      this.preprocessor
    );

    // Use provided blueId if available, otherwise use calculated one
    const blueId = providedBlueId || parsedContent.blueId;

    this.blueIdToContentMap.set(blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(blueId, false);

    // Add name mapping if node has a name
    const nodeName = node.getName();
    if (nodeName) {
      this.addToNameMap(nodeName, blueId);
    }
  }

  private processMultipleDocuments(
    contents: JsonBlueValue[],
    providedBlueId?: string
  ): void {
    const nodes = contents.map((item) => {
      const node = NodeDeserializer.deserialize(item);
      return this.preprocessor(node);
    });

    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNodeList(
      nodes,
      (node) => node // Already preprocessed above
    );

    // Use provided blueId if available, otherwise use calculated one
    const blueId = providedBlueId || parsedContent.blueId;

    this.blueIdToContentMap.set(blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(blueId, true);

    // Process individual items and add name mappings
    nodes.forEach((node, index) => {
      // Store individual items with their # reference
      const itemBlueId = `${blueId}#${index}`;
      const itemContent = NodeToMapListOrValue.get(node);

      // Also calculate and store the individual item's own blueId
      const individualBlueId = BlueIdCalculator.calculateBlueIdSync(node);
      this.blueIdToContentMap.set(individualBlueId, itemContent);
      this.blueIdToMultipleDocumentsMap.set(individualBlueId, false);

      // Add name mapping with # reference
      const nodeName = node.getName();
      if (nodeName) {
        this.addToNameMap(nodeName, itemBlueId);
      }
    });
  }

  protected override fetchContentByBlueId(
    baseBlueId: string
  ): JsonBlueValue | null {
    const content = this.blueIdToContentMap.get(baseBlueId);
    const isMultipleDocuments =
      this.blueIdToMultipleDocumentsMap.get(baseBlueId);

    if (content !== undefined && isMultipleDocuments !== undefined) {
      return NodeContentHandler.resolveThisReferences(
        content,
        baseBlueId,
        isMultipleDocuments
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
}
