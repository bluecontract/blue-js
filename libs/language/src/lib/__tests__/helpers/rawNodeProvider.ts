import { JsonBlueValue } from '../../../schema';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { NodeProvider } from '../../NodeProvider';
import { BlueNode, NodeDeserializer } from '../../model';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { Nodes } from '../../utils/Nodes';

export class RawNodeProvider extends NodeProvider {
  private readonly blueIdToNodesMap = new Map<string, BlueNode[]>();

  public addNode(blueId: string, node: BlueNode): void {
    this.blueIdToNodesMap.set(blueId, [this.stripLegacyRootBlueId(node)]);
  }

  public addNodes(blueId: string, nodes: BlueNode[]): void {
    this.blueIdToNodesMap.set(
      blueId,
      nodes.map((node) => this.stripLegacyRootBlueId(node)),
    );
  }

  public fetchByBlueId(blueId: string): BlueNode[] {
    return this.blueIdToNodesMap.get(blueId)?.map((node) => node.clone()) ?? [];
  }

  private stripLegacyRootBlueId(node: BlueNode): BlueNode {
    if (node.getReferenceBlueId() !== undefined && !Nodes.hasBlueIdOnly(node)) {
      return node.clone().setBlueId(undefined);
    }

    return node.clone();
  }
}

export function createRawNodeProviderFromYamlDocs(
  ...docs: string[]
): RawNodeProvider {
  const provider = new RawNodeProvider();

  for (const doc of docs) {
    const parsed = yamlBlueParse(doc) as JsonBlueValue | undefined;
    if (parsed === undefined) {
      throw new Error('Failed to parse raw node provider fixture');
    }

    const node = NodeDeserializer.deserialize(parsed);
    const blueId =
      node.getReferenceBlueId() ?? BlueIdCalculator.calculateBlueIdSync(node);
    provider.addNode(blueId, node);
  }

  return provider;
}
