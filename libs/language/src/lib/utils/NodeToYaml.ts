import { JsonValue } from 'type-fest';
import { BlueNode } from '../model';
import {
  BlueIdMode,
  NodeToMapListOrValue,
  Strategy,
} from './NodeToMapListOrValue';
import { yamlBlueDump } from '../../utils/yamlBlue';

export interface NodeToYamlOptions {
  strategy?: Strategy;
  blueIdMode?: BlueIdMode;
}

export class NodeToYaml {
  static get(node: BlueNode, options: NodeToYamlOptions = {}): string {
    const { strategy = 'official', blueIdMode = 'referenceOnly' } = options;
    const jsonValue = NodeToMapListOrValue.get(node, {
      strategy,
      blueIdMode,
    }) as JsonValue;
    return yamlBlueDump(jsonValue);
  }
}
