import { BlueNode, NodeDeserializer } from '../model';
import { NodeToMapListOrValue } from '../utils';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { JsonBlueValue, JsonBlueObject } from '../../schema';
import { OBJECT_BLUE_ID } from '../utils/Properties';

export interface StorageContentProcessor {
  prepareStorageNode(
    node: BlueNode,
    preprocessor: (node: BlueNode) => BlueNode,
  ): { blueId: string; node: BlueNode };

  prepareStorageNodeList(
    nodes: BlueNode[],
    preprocessor: (node: BlueNode) => BlueNode,
  ): { blueId: string; nodes: BlueNode[] };
}

export class ParsedContent {
  constructor(
    public readonly blueId: string,
    public readonly content: JsonBlueValue,
    public readonly isMultipleDocuments: boolean,
  ) {}
}

export class NodeContentHandler {
  private static readonly THIS_REFERENCE_PATTERN = /^this(#\d+)?$/;

  public static parseAndCalculateBlueId(
    content: string,
    preprocessor: (node: BlueNode) => BlueNode,
    storageProcessor: StorageContentProcessor,
  ): ParsedContent {
    let jsonNode: JsonBlueValue;

    try {
      const parsed = yamlBlueParse(content);
      if (parsed === undefined) {
        throw new Error();
      }
      jsonNode = parsed;
    } catch {
      throw new Error('Failed to parse content as YAML or JSON');
    }

    let blueId: string;
    let resultContent: JsonBlueValue;
    const isMultipleDocuments = Array.isArray(jsonNode) && jsonNode.length > 1;

    if (isMultipleDocuments) {
      const nodes = (jsonNode as JsonBlueValue[]).map((item: JsonBlueValue) =>
        NodeDeserializer.deserialize(item),
      );
      const prepared = storageProcessor.prepareStorageNodeList(
        nodes,
        preprocessor,
      );
      blueId = prepared.blueId;
      resultContent = prepared.nodes.map((node) =>
        NodeToMapListOrValue.get(node),
      );
    } else {
      const node = NodeDeserializer.deserialize(jsonNode);
      const prepared = storageProcessor.prepareStorageNode(node, preprocessor);
      blueId = prepared.blueId;
      resultContent = NodeToMapListOrValue.get(prepared.node);
    }

    return new ParsedContent(blueId, resultContent, isMultipleDocuments);
  }

  public static parseAndCalculateBlueIdForNode(
    node: BlueNode,
    preprocessor: (node: BlueNode) => BlueNode,
    storageProcessor: StorageContentProcessor,
  ): ParsedContent {
    const prepared = storageProcessor.prepareStorageNode(node, preprocessor);
    const jsonNode = NodeToMapListOrValue.get(prepared.node);

    return new ParsedContent(prepared.blueId, jsonNode, false);
  }

  public static parseAndCalculateBlueIdForNodeList(
    nodes: BlueNode[],
    preprocessor: (node: BlueNode) => BlueNode,
    storageProcessor: StorageContentProcessor,
  ): ParsedContent {
    if (!nodes || nodes.length === 0) {
      throw new Error('List of nodes cannot be null or empty');
    }

    const prepared = storageProcessor.prepareStorageNodeList(
      nodes,
      preprocessor,
    );
    const jsonNodes = prepared.nodes.map((node) =>
      NodeToMapListOrValue.get(node),
    );
    const isMultipleDocuments = nodes.length > 1;

    return new ParsedContent(prepared.blueId, jsonNodes, isMultipleDocuments);
  }

  public static resolveThisReferences(
    content: JsonBlueValue,
    currentBlueId: string,
    isMultipleDocuments: boolean,
  ): JsonBlueValue {
    return this.resolveThisReferencesRecursive(
      content,
      currentBlueId,
      isMultipleDocuments,
    );
  }

  private static resolveThisReferencesRecursive(
    content: JsonBlueValue,
    currentBlueId: string,
    isMultipleDocuments: boolean,
  ): JsonBlueValue {
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      // Handle objects
      const result: JsonBlueObject = {};
      for (const [key, value] of Object.entries(content)) {
        if (typeof value === 'string') {
          if (
            key === OBJECT_BLUE_ID &&
            this.THIS_REFERENCE_PATTERN.test(value)
          ) {
            result[key] = this.resolveThisReference(
              value,
              currentBlueId,
              isMultipleDocuments,
            );
          } else {
            result[key] = value;
          }
        } else if (value && typeof value === 'object') {
          result[key] = this.resolveThisReferencesRecursive(
            value,
            currentBlueId,
            isMultipleDocuments,
          );
        } else {
          result[key] = value;
        }
      }
      return result;
    } else if (Array.isArray(content)) {
      // Handle arrays
      return content.map((element) => {
        if (element && typeof element === 'object') {
          return this.resolveThisReferencesRecursive(
            element,
            currentBlueId,
            isMultipleDocuments,
          );
        }
        return element;
      });
    }
    return content;
  }

  private static resolveThisReference(
    textValue: string,
    currentBlueId: string,
    isMultipleDocuments: boolean,
  ): string {
    if (isMultipleDocuments) {
      if (!textValue.startsWith('this#')) {
        throw new Error(
          "For multiple documents, 'this' references must include an index (e.g., 'this#0')",
        );
      }
      return currentBlueId + textValue.substring(4);
    } else {
      if (textValue === 'this') {
        return currentBlueId;
      } else {
        throw new Error(
          "For a single document, only 'this' is allowed as a reference, not 'this#<id>'",
        );
      }
    }
  }
}
