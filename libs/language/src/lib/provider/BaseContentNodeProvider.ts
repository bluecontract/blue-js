import { yamlBlueParse } from '../../utils/yamlBlue';
import { BlueNode, NodeDeserializer } from '../model';
import { NodeProvider } from '../NodeProvider';
import { BlueIdCalculator } from '../utils';

import DefaultBlueYaml from '../resources/transformation/DefaultBlue.yaml?raw';
import TransformationBlueYaml from '../resources/transformation/Transformation.yaml?raw';
import InferBasicTypesForUntypedValuesYaml from '../resources/transformation/InferBasicTypesForUntypedValues.yaml?raw';
import ReplaceInlineTypesWithBlueIdsYaml from '../resources/transformation/ReplaceInlineTypesWithBlueIds.yaml?raw';

const contents = [
  DefaultBlueYaml,
  TransformationBlueYaml,
  InferBasicTypesForUntypedValuesYaml,
  ReplaceInlineTypesWithBlueIdsYaml,
];

export class BaseContentNodeProvider extends NodeProvider {
  private blueIdToNodesMap: Map<string, BlueNode[]> = new Map();

  constructor() {
    super();
    this.load();
  }

  override fetchByBlueId(blueId: string): BlueNode[] {
    return this.blueIdToNodesMap.get(blueId) || [];
  }

  private load() {
    for (const content of contents) {
      const parsedYaml = yamlBlueParse(content);

      if (parsedYaml === undefined) {
        console.error(`This content file is not valid YAML: ${content}`);
        continue;
      }

      if (Array.isArray(parsedYaml)) {
        const nodes = parsedYaml.map((item) =>
          NodeDeserializer.deserialize(item),
        );
        const blueId = BlueIdCalculator.calculateBlueIdSync(nodes);
        this.blueIdToNodesMap.set(blueId, nodes);
      } else {
        const node = NodeDeserializer.deserialize(parsedYaml);
        const blueId = BlueIdCalculator.calculateBlueIdSync(node);
        this.blueIdToNodesMap.set(blueId, [node]);
      }
    }
  }
}
