import { BlueNode } from '@blue-labs/language';

type FrozenNodeLike = {
  toNode(): BlueNode;
};

export class BexProgramSource {
  private constructor(
    public readonly node: BlueNode,
    public readonly definitionNode?: BlueNode,
    public readonly entry?: string,
  ) {}

  public static inline(node: BlueNode | FrozenNodeLike): BexProgramSource {
    return new BexProgramSource('toNode' in node ? node.toNode() : node);
  }

  public static withDefinition(
    node: BlueNode | FrozenNodeLike,
    definitionNode: BlueNode | FrozenNodeLike,
    entry?: string,
  ): BexProgramSource {
    return new BexProgramSource(
      'toNode' in node ? node.toNode() : node,
      'toNode' in definitionNode ? definitionNode.toNode() : definitionNode,
      entry,
    );
  }
}
