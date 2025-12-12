import { JsonValue } from 'type-fest';
import { BlueNode } from '../model';
import { NodeToMapListOrValue, Strategy } from './NodeToMapListOrValue';
import { yamlBlueDump } from '../../utils/yamlBlue';

export interface NodeToYamlOptions {
  strategy?: Strategy;
}

export class NodeToYaml {
  static get(node: BlueNode, options: NodeToYamlOptions = {}): string {
    const { strategy = 'official' } = options;
    const jsonValue = NodeToMapListOrValue.get(node, strategy) as JsonValue;
    return yamlBlueDump(jsonValue);
  }
}
