import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { NodeTransformer } from './NodeTransformer';
import { CORE_TYPE_BLUE_ID_TO_NAME_MAP } from './Properties';
import { BlueIdsMappingGenerator } from '../preprocess/utils/BlueIdsMappingGenerator';

export interface InlineTypeRestorerOptions {
  nodeProvider: NodeProvider;
  blueIdsMappingGenerator: BlueIdsMappingGenerator;
}

/**
 * Restores inline type declarations by converting BlueId references back to their inline values.
 */
export class InlineTypeRestorer {
  private readonly nodeProvider: NodeProvider;
  private readonly blueIdToInlineValue: Map<string, string> = new Map();

  constructor(options: InlineTypeRestorerOptions) {
    const { nodeProvider, blueIdsMappingGenerator } = options;
    this.nodeProvider = nodeProvider;

    // Seed with core Blue type mappings so we always have defaults available.
    Object.entries(CORE_TYPE_BLUE_ID_TO_NAME_MAP).forEach(([blueId, name]) => {
      this.blueIdToInlineValue.set(blueId, name);
    });

    // Add dynamically registered mappings (repositories, manual registrations, etc.).
    const allRegisteredBlueIds = blueIdsMappingGenerator.getAllBlueIds();
    Object.entries(allRegisteredBlueIds).forEach(([inlineName, blueId]) => {
      if (!this.blueIdToInlineValue.has(blueId)) {
        this.blueIdToInlineValue.set(blueId, inlineName);
      }
    });
  }

  /**
   * Returns a new BlueNode where all type references are restored to inline values when possible.
   */
  public restore(node: BlueNode): BlueNode {
    return NodeTransformer.transform(node, (current) =>
      this.restoreNode(current),
    );
  }

  private restoreNode(node: BlueNode): BlueNode {
    this.restoreTypeField(
      node,
      () => node.getType(),
      (value) => node.setType(value),
    );

    this.restoreTypeField(
      node,
      () => node.getItemType(),
      (value) => node.setItemType(value),
    );

    this.restoreTypeField(
      node,
      () => node.getKeyType(),
      (value) => node.setKeyType(value),
    );

    this.restoreTypeField(
      node,
      () => node.getValueType(),
      (value) => node.setValueType(value),
    );

    return node;
  }

  private restoreTypeField(
    node: BlueNode,
    getter: () => BlueNode | undefined,
    setter: (value: BlueNode | undefined) => void,
  ): void {
    const typeNode = getter();
    if (!typeNode) {
      return;
    }

    if (typeNode.isInlineValue() && typeNode.getValue() !== undefined) {
      return;
    }

    const blueId = typeNode.getBlueId();
    if (!blueId) {
      return;
    }

    const inlineValue = this.resolveInlineValue(blueId, typeNode);
    if (!inlineValue) {
      return;
    }

    const inlineNode = new BlueNode()
      .setValue(inlineValue)
      .setInlineValue(true);
    setter(inlineNode);
  }

  private resolveInlineValue(
    blueId: string,
    contextNode: BlueNode,
  ): string | undefined {
    const cached = this.blueIdToInlineValue.get(blueId);
    if (cached) {
      return cached;
    }

    const contextName = contextNode.getName();
    if (contextName) {
      this.blueIdToInlineValue.set(blueId, contextName);
      return contextName;
    }

    const resolved = this.nodeProvider.fetchFirstByBlueId(blueId);
    const resolvedName = resolved?.getName();
    if (resolvedName) {
      this.blueIdToInlineValue.set(blueId, resolvedName);
      return resolvedName;
    }

    return undefined;
  }
}
