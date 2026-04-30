import { PreloadedNodeProvider } from './PreloadedNodeProvider';
import { NodeContentHandler } from './NodeContentHandler';
import { BlueNode, NodeDeserializer } from '../model';
import { JsonBlueValue } from '../../schema';
import { BlueRepository } from '../types/BlueRepository';
import type { MergingProcessor } from '../merge/MergingProcessor';
import { canonicalizeRepositoryContent } from '../repository/RepositoryContentCanonicalizer';

/**
 * A NodeProvider that indexes content from trusted BlueRepository definitions.
 * Similar to Java's ClasspathBasedNodeProvider but for repository content.
 */
export class RepositoryBasedNodeProvider extends PreloadedNodeProvider {
  private blueIdToContentMap: Map<string, JsonBlueValue> = new Map();
  private blueIdToMultipleDocumentsMap: Map<string, boolean> = new Map();
  private aliasBlueIdMap: Map<string, string> = new Map();

  constructor(
    repositories: BlueRepository[],
    _options: { mergingProcessor?: MergingProcessor } = {},
  ) {
    super();

    const aliasMappings =
      RepositoryBasedNodeProvider.collectAliasMappings(repositories);
    this.aliasBlueIdMap = new Map(Object.entries(aliasMappings));

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
          const canonicalContent = canonicalizeRepositoryContent(content);
          this.storeContent(
            providedBlueId,
            canonicalContent,
            Array.isArray(canonicalContent),
          );
          this.addContentNames(providedBlueId, canonicalContent);
        }
      });
    }
  }

  private addContentNames(blueId: string, content: JsonBlueValue): void {
    if (Array.isArray(content)) {
      this.addListItemNames(blueId, content);
      return;
    }

    const node = NodeDeserializer.deserialize(content);
    const nodeName = node.getName();
    if (nodeName) {
      this.addToNameMap(nodeName, blueId);
    }
  }

  private addListItemNames(blueId: string, content: JsonBlueValue): void {
    if (!Array.isArray(content)) {
      return;
    }

    content.forEach((item, index) => {
      const node = NodeDeserializer.deserialize(item);
      const nodeName = node.getName();
      if (nodeName) {
        this.addToNameMap(nodeName, `${blueId}#${index}`);
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

  override fetchByBlueId(blueId: string): BlueNode[] | null {
    const resolvedBlueId = this.resolveAliasBlueId(blueId);
    if (resolvedBlueId === undefined) {
      return null;
    }

    return super.fetchByBlueId(resolvedBlueId);
  }

  private storeContent(
    blueId: string,
    content: JsonBlueValue,
    isMultipleDocuments: boolean,
  ): void {
    this.blueIdToContentMap.set(blueId, content);
    this.blueIdToMultipleDocumentsMap.set(blueId, isMultipleDocuments);
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
    const resolvedBlueId = this.resolveAliasBlueId(blueId);
    if (resolvedBlueId === undefined) {
      return false;
    }

    return this.blueIdToContentMap.has(
      this.getBaseBlueIdAndSuffix(resolvedBlueId).baseBlueId,
    );
  }

  private resolveAliasBlueId(blueId: string): string | undefined {
    const exactAlias = this.aliasBlueIdMap.get(blueId);
    if (exactAlias !== undefined) {
      return exactAlias;
    }

    const { baseBlueId, suffix } = this.getBaseBlueIdAndSuffix(blueId);
    if (suffix === undefined) {
      return blueId;
    }

    const mappedBaseBlueId = this.aliasBlueIdMap.get(baseBlueId);
    if (mappedBaseBlueId === undefined) {
      return blueId;
    }

    if (this.getBaseBlueIdAndSuffix(mappedBaseBlueId).suffix !== undefined) {
      return undefined;
    }

    return `${mappedBaseBlueId}${suffix}`;
  }

  private getBaseBlueIdAndSuffix(blueId: string): {
    baseBlueId: string;
    suffix?: string;
  } {
    const separatorIndex = blueId.indexOf('#');
    if (separatorIndex === -1) {
      return { baseBlueId: blueId };
    }

    return {
      baseBlueId: blueId.slice(0, separatorIndex),
      suffix: blueId.slice(separatorIndex),
    };
  }
}
