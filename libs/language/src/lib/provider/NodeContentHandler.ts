import { BlueNode, NodeDeserializer } from '../model';
import { BlueIdCalculator, NodeToMapListOrValue } from '../utils';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { JsonBlueValue, JsonBlueObject } from '../../schema';

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
      const nodes = (jsonNode as JsonBlueValue[]).map((item: JsonBlueValue) => {
        const node = NodeDeserializer.deserialize(item);
        return preprocessor(node);
      });
      blueId = BlueIdCalculator.calculateBlueIdSync(nodes);
      resultContent = nodes.map((node) => NodeToMapListOrValue.get(node));
    } else {
      const node = NodeDeserializer.deserialize(jsonNode);
      const processedNode = preprocessor(node);
      blueId = BlueIdCalculator.calculateBlueIdSync(processedNode);
      resultContent = NodeToMapListOrValue.get(processedNode);
    }

    return new ParsedContent(blueId, resultContent, isMultipleDocuments);
  }

  public static parseAndCalculateBlueIdForNode(
    node: BlueNode,
    preprocessor: (node: BlueNode) => BlueNode,
  ): ParsedContent {
    const preprocessedNode = preprocessor(node);
    const blueId = BlueIdCalculator.calculateBlueIdSync(preprocessedNode);
    const jsonNode = NodeToMapListOrValue.get(preprocessedNode);

    return new ParsedContent(blueId, jsonNode, false);
  }

  public static parseAndCalculateBlueIdForNodeList(
    nodes: BlueNode[],
    preprocessor: (node: BlueNode) => BlueNode,
  ): ParsedContent {
    if (!nodes || nodes.length === 0) {
      throw new Error('List of nodes cannot be null or empty');
    }

    const preprocessedNodes = nodes.map(preprocessor);
    const blueId = BlueIdCalculator.calculateBlueIdSync(preprocessedNodes);
    const jsonNodes = preprocessedNodes.map((node) =>
      NodeToMapListOrValue.get(node),
    );
    const isMultipleDocuments = nodes.length > 1;

    return new ParsedContent(blueId, jsonNodes, isMultipleDocuments);
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
          if (this.THIS_REFERENCE_PATTERN.test(value)) {
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
        if (typeof element === 'string') {
          if (this.THIS_REFERENCE_PATTERN.test(element)) {
            return this.resolveThisReference(
              element,
              currentBlueId,
              isMultipleDocuments,
            );
          }
          return element;
        } else if (element && typeof element === 'object') {
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
