import { BlueNode, NodeDeserializer } from '../model';
import { PreloadedNodeProvider } from './PreloadedNodeProvider';
import { Preprocessor } from '../preprocess/Preprocessor';
import { NodeContentHandler } from './NodeContentHandler';
import { BlueIdCalculator, NodeToMapListOrValue, Nodes } from '../utils';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { JsonBlueValue } from '../../schema';

export class BasicNodeProvider extends PreloadedNodeProvider {
  private blueIdToContentMap: Map<string, JsonBlueValue> = new Map();
  private blueIdToMultipleDocumentsMap: Map<string, boolean> = new Map();
  private preprocessor: (node: BlueNode) => BlueNode;

  constructor(nodes: BlueNode[] = []) {
    super();

    // Create default preprocessor
    const defaultPreprocessor = new Preprocessor({ nodeProvider: this });
    this.preprocessor = (node: BlueNode) =>
      defaultPreprocessor.preprocessWithDefaultBlue(node);

    // Process initial nodes
    nodes.forEach((node) => this.processNode(node));
  }

  private processNode(node: BlueNode): void {
    if (Nodes.hasItemsOnly(node)) {
      this.processNodeWithItems(node);
    } else {
      this.processSingleNode(node);
    }
  }

  private processSingleNode(node: BlueNode): void {
    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNode(
      node,
      this.preprocessor
    );
    this.blueIdToContentMap.set(parsedContent.blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(
      parsedContent.blueId,
      parsedContent.isMultipleDocuments
    );
    const nodeName = node.getName();
    if (nodeName) {
      this.addToNameMap(nodeName, parsedContent.blueId);
    }
  }

  private processNodeWithItems(node: BlueNode): void {
    const items = node.getItems();
    if (!items) return;

    this.processNodeList(items);

    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNodeList(
      items,
      this.preprocessor
    );
    this.blueIdToContentMap.set(parsedContent.blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(parsedContent.blueId, true);

    items.forEach((item, i) => {
      const nodeName = item.getName();
      if (nodeName) {
        this.addToNameMap(nodeName, `${parsedContent.blueId}#${i}`);
      }
    });
  }

  public processNodeList(nodes: BlueNode[]): void {
    const listBlueId = BlueIdCalculator.calculateBlueIdSync(nodes);
    // Convert nodes to JSON representation for storage
    const jsonContent = nodes.map((n) => NodeToMapListOrValue.get(n));
    this.blueIdToContentMap.set(listBlueId, jsonContent);
    this.blueIdToMultipleDocumentsMap.set(listBlueId, true);
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
   * Add single nodes to the provider
   * @param nodes - The nodes to add
   */
  public addSingleNodes(...nodes: BlueNode[]): void {
    nodes.forEach((node) => this.processNode(node));
  }

  /**
   * Add single documents (as YAML strings) to the provider
   * @param docs - The YAML documents to add
   */
  public addSingleDocs(...docs: string[]): void {
    docs.forEach((doc) => {
      const parsed = yamlBlueParse(doc);
      if (parsed !== undefined) {
        const node = NodeDeserializer.deserialize(parsed);
        this.processNode(node);
      }
    });
  }

  /**
   * Get Blue ID by name
   * @param name - The name to look up
   * @returns The Blue ID for the given name
   * @throws Error if no node with the given name exists
   */
  public getBlueIdByName(name: string): string {
    const blueIds = this.nameToBlueIdsMap.get(name);
    if (!blueIds || blueIds.length === 0) {
      throw new Error(`No node with name "${name}"`);
    }
    return blueIds[0];
  }

  /**
   * Get node by name
   * @param name - The name to look up
   * @returns The node with the given name
   * @throws Error if no node with the given name exists
   */
  public getNodeByName(name: string): BlueNode {
    const node = this.findNodeByName(name);
    if (!node) {
      throw new Error(`No node with name "${name}"`);
    }
    return node;
  }

  /**
   * Add a list and its items to the provider
   * @param list - The list of nodes to add
   */
  private addListAndItsItemsFromNodes(list: BlueNode[]): void {
    this.processNodeList(list);
    list.forEach((node) => this.processNode(node));
  }

  /**
   * Add a list and its items from a YAML document
   * @param doc - The YAML document containing a list
   */
  private addListAndItsItemsFromDoc(doc: string): void {
    const parsed = yamlBlueParse(doc);
    if (parsed !== undefined) {
      const node = NodeDeserializer.deserialize(parsed);
      const items = node.getItems();
      if (items) {
        this.addListAndItsItems(items);
      }
    }
  }

  /**
   * Add a list and its items to the provider
   * @param listOrDoc - The list of nodes or the YAML document containing a list
   */
  public addListAndItsItems(listOrDoc: BlueNode[] | string): void {
    if (Array.isArray(listOrDoc)) {
      this.addListAndItsItemsFromNodes(listOrDoc);
    } else {
      this.addListAndItsItemsFromDoc(listOrDoc);
    }
  }

  /**
   * Add a list (without processing individual items)
   * @param list - The list of nodes to add
   */
  public addList(list: BlueNode[]): void {
    this.processNodeList(list);
  }
}
