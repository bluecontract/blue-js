import { PreloadedNodeProvider } from './PreloadedNodeProvider';
import { NodeContentHandler } from './NodeContentHandler';
import { BlueNode, NodeDeserializer } from '../model';
import { JsonBlueValue } from '../../schema';
import { BlueRepository } from '../types/BlueRepository';
import { Preprocessor } from '../preprocess/Preprocessor';
import { BlueIdsMappingGenerator } from '../preprocess/utils/BlueIdsMappingGenerator';
import { SemanticStorageService } from '../identity/SemanticStorageService';
import { NodeToMapListOrValue } from '../utils';
import { BlueError, BlueErrorCode } from '../errors/BlueError';
import type { MergingProcessor } from '../merge/MergingProcessor';

/**
 * A NodeProvider that processes content from BlueRepository definitions.
 * Similar to Java's ClasspathBasedNodeProvider but for repository content.
 */
export class RepositoryBasedNodeProvider extends PreloadedNodeProvider {
  private blueIdToContentMap: Map<string, JsonBlueValue> = new Map();
  private blueIdToMultipleDocumentsMap: Map<string, boolean> = new Map();
  private aliasBlueIdMap: Map<string, string> = new Map();

  // Repository contents can reference each other while the provider is still
  // being built. These bootstrap maps are readable only during construction and
  // are cleared once strict semantic storage keys have been verified.
  private bootstrapBlueIdToContentMap: Map<string, JsonBlueValue> = new Map();
  private bootstrapBlueIdToMultipleDocumentsMap: Map<string, boolean> =
    new Map();
  private readonly preprocessor: (node: BlueNode) => BlueNode;
  private readonly storageService: SemanticStorageService;

  constructor(
    repositories: BlueRepository[],
    options: { mergingProcessor?: MergingProcessor } = {},
  ) {
    super();

    const blueIdsMappingGenerator = new BlueIdsMappingGenerator();
    const aliasMappings =
      RepositoryBasedNodeProvider.collectAliasMappings(repositories);
    this.aliasBlueIdMap = new Map(Object.entries(aliasMappings));
    if (Object.keys(aliasMappings).length > 0) {
      blueIdsMappingGenerator.registerBlueIds(aliasMappings);
    }

    const defaultPreprocessor = new Preprocessor({
      nodeProvider: this,
      blueIdsMappingGenerator,
    });
    this.preprocessor = (node: BlueNode) =>
      defaultPreprocessor.preprocessWithDefaultBlue(node);
    this.storageService = new SemanticStorageService({
      nodeProvider: this,
      mergingProcessor: options.mergingProcessor,
    });

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
    // First pass makes package-provided keys available so semantic resolve can
    // follow intra-repository references while each content item is processed.
    for (const repository of repositories) {
      Object.values(repository.packages).forEach((pkg) => {
        for (const [providedBlueId, content] of Object.entries(pkg.contents)) {
          this.seedPreprocessedContent(providedBlueId, content);
        }
      });
    }

    for (const repository of repositories) {
      Object.values(repository.packages).forEach((pkg) => {
        for (const [providedBlueId, content] of Object.entries(pkg.contents)) {
          this.processContent(content, providedBlueId);
        }
      });
    }

    // After this point only semantic storage IDs remain externally fetchable.
    this.bootstrapBlueIdToContentMap.clear();
    this.bootstrapBlueIdToMultipleDocumentsMap.clear();
  }

  private seedPreprocessedContent(
    providedBlueId: string,
    content: JsonBlueValue,
  ): void {
    if (Array.isArray(content)) {
      const preprocessed = content.map((item) =>
        NodeToMapListOrValue.get(
          this.preprocessor(NodeDeserializer.deserialize(item)),
        ),
      );
      this.bootstrapBlueIdToContentMap.set(providedBlueId, preprocessed);
      this.bootstrapBlueIdToMultipleDocumentsMap.set(providedBlueId, true);
      return;
    }

    const preprocessed = this.preprocessor(
      NodeDeserializer.deserialize(content),
    );
    this.bootstrapBlueIdToContentMap.set(
      providedBlueId,
      NodeToMapListOrValue.get(preprocessed),
    );
    this.bootstrapBlueIdToMultipleDocumentsMap.set(providedBlueId, false);
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
      this.storageService,
    );

    this.assertProvidedBlueId(parsedContent.blueId, providedBlueId);
    this.storeContent(parsedContent.blueId, parsedContent.content, false);

    const nodeName = node.getName();
    if (nodeName) {
      this.addToNameMap(nodeName, parsedContent.blueId);
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
      this.storageService,
    );

    this.assertProvidedBlueId(parsedContent.blueId, providedBlueId);
    this.storeContent(
      parsedContent.blueId,
      parsedContent.content,
      parsedContent.isMultipleDocuments,
    );

    if (parsedContent.isCyclicSet) {
      this.addListItemNames(parsedContent.blueId, parsedContent.content);
      return;
    }

    nodes.forEach((node, index) => {
      const itemBlueId = `${parsedContent.blueId}#${index}`;
      const itemParsedContent =
        NodeContentHandler.parseAndCalculateBlueIdForNode(
          node,
          (n) => n,
          this.storageService,
        );
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
    const storageBlueId = this.aliasBlueIdMap.get(baseBlueId) ?? baseBlueId;
    const finalContent = this.blueIdToContentMap.get(storageBlueId);
    const finalIsMultipleDocuments =
      this.blueIdToMultipleDocumentsMap.get(storageBlueId);

    if (finalContent !== undefined && finalIsMultipleDocuments !== undefined) {
      return NodeContentHandler.resolveThisReferences(
        finalContent,
        storageBlueId,
        finalIsMultipleDocuments,
      );
    }

    // Bootstrap lookup is only populated during constructor-time processing.
    // It is not a historical-ID compatibility path after loadRepositories()
    // clears the maps.
    const content = this.bootstrapBlueIdToContentMap.get(storageBlueId);
    const isMultipleDocuments =
      this.bootstrapBlueIdToMultipleDocumentsMap.get(storageBlueId);

    if (content !== undefined && isMultipleDocuments !== undefined) {
      return NodeContentHandler.resolveThisReferences(
        content,
        storageBlueId,
        isMultipleDocuments,
      );
    }

    return null;
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
    const baseBlueId = blueId.split('#')[0];
    const storageBlueId = this.aliasBlueIdMap.get(baseBlueId) ?? baseBlueId;
    return this.blueIdToContentMap.has(storageBlueId);
  }

  private assertProvidedBlueId(
    computedBlueId: string,
    providedBlueId?: string,
  ): void {
    if (providedBlueId === undefined) {
      return;
    }

    if (providedBlueId !== computedBlueId) {
      throw new BlueError(
        BlueErrorCode.BLUE_ID_MISMATCH,
        `Repository content key '${providedBlueId}' does not match semantic BlueId '${computedBlueId}'.`,
        [
          {
            code: BlueErrorCode.BLUE_ID_MISMATCH,
            message:
              'Repository contents must be keyed by the semantic BlueId of their minimal storage form.',
            context: { providedBlueId, computedBlueId },
          },
        ],
      );
    }
  }
}
