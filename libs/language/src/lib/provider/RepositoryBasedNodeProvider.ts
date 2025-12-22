import { PreloadedNodeProvider } from './PreloadedNodeProvider';
import { NodeContentHandler } from './NodeContentHandler';
import { BlueNode, NodeDeserializer } from '../model';
import { JsonBlueValue } from '../../schema';
import { BlueRepository } from '../types/BlueRepository';
import type { BlueIdMapper } from '../types/BlueIdMapper';

/**
 * A NodeProvider that processes content from BlueRepository definitions.
 * Similar to Java's ClasspathBasedNodeProvider but for repository content.
 */
export class RepositoryBasedNodeProvider extends PreloadedNodeProvider {
  private blueIdToContentMap: Map<string, JsonBlueValue> = new Map();
  private blueIdToMultipleDocumentsMap: Map<string, boolean> = new Map();
  private readonly blueIdMapper?: BlueIdMapper;

  constructor(repositories: BlueRepository[], blueIdMapper?: BlueIdMapper) {
    super();
    this.blueIdMapper = blueIdMapper;

    // Process all repository contents
    this.loadRepositories(repositories);
  }

  private loadRepositories(repositories: BlueRepository[]): void {
    for (const repository of repositories) {
      Object.values(repository.packages).forEach((pkg) => {
        for (const [providedBlueId, content] of Object.entries(pkg.contents)) {
          this.storeContent(providedBlueId, content);
          this.indexNameMappings(providedBlueId, content);
        }
      });
    }
  }

  private storeContent(providedBlueId: string, content: JsonBlueValue): void {
    this.blueIdToContentMap.set(providedBlueId, content);
    this.blueIdToMultipleDocumentsMap.set(
      providedBlueId,
      Array.isArray(content),
    );
  }

  private indexNameMappings(providedBlueId: string, content: JsonBlueValue) {
    if (Array.isArray(content)) {
      content.forEach((item, idx) => {
        const node = NodeDeserializer.deserialize(item);
        const nodeName = node.getName();
        if (nodeName) {
          this.addToNameMap(nodeName, `${providedBlueId}#${idx}`);
        }
      });
      return;
    }

    const node = NodeDeserializer.deserialize(content);
    const nodeName = node.getName();
    if (nodeName) {
      this.addToNameMap(nodeName, providedBlueId);
    }
  }

  protected override fetchContentByBlueId(
    baseBlueId: string,
  ): JsonBlueValue | null {
    const lookupBlueId =
      this.blueIdMapper?.toCurrentBlueId(baseBlueId) ?? baseBlueId;
    const content = this.blueIdToContentMap.get(lookupBlueId);
    const isMultipleDocuments =
      this.blueIdToMultipleDocumentsMap.get(lookupBlueId);

    if (content !== undefined && isMultipleDocuments !== undefined) {
      return NodeContentHandler.resolveThisReferences(
        content,
        lookupBlueId,
        isMultipleDocuments,
      );
    }

    return null;
  }

  override fetchByBlueId(blueId: string): BlueNode[] | null {
    const baseBlueId = blueId.split('#')[0];
    const lookupBlueId =
      this.blueIdMapper?.toCurrentBlueId(baseBlueId) ?? baseBlueId;
    const content = this.blueIdToContentMap.get(lookupBlueId);
    const isMultipleDocuments =
      this.blueIdToMultipleDocumentsMap.get(lookupBlueId);

    if (content === undefined || isMultipleDocuments === undefined) {
      return null;
    }

    const resolvedContent = NodeContentHandler.resolveThisReferences(
      content,
      lookupBlueId,
      isMultipleDocuments,
    );

    const mappedBlueId =
      this.blueIdMapper?.toCurrentBlueId(baseBlueId) ?? baseBlueId;

    if (blueId.includes('#')) {
      const parts = blueId.split('#');
      if (parts.length > 1) {
        const index = parseInt(parts[1]);
        if (Array.isArray(resolvedContent) && index < resolvedContent.length) {
          const item = resolvedContent[index];
          const node = NodeDeserializer.deserialize(item);

          node.setBlueId(`${mappedBlueId}#${index}`);
          return [node];
        } else if (index === 0) {
          const node = NodeDeserializer.deserialize(resolvedContent);
          node.setBlueId(`${mappedBlueId}#${index}`);
          return [node];
        }
        return null;
      }
    }

    if (Array.isArray(resolvedContent)) {
      return resolvedContent.map((item, idx) => {
        const node = NodeDeserializer.deserialize(item);
        node.setBlueId(`${mappedBlueId}#${idx}`);
        return node;
      });
    } else {
      const node = NodeDeserializer.deserialize(resolvedContent);
      node.setBlueId(mappedBlueId);
      return [node];
    }
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
    const lookupBlueId =
      this.blueIdMapper?.toCurrentBlueId(baseBlueId) ?? baseBlueId;
    return this.blueIdToContentMap.has(lookupBlueId);
  }
}
