import { BlueNode } from '../model';
import { NodeToMapListOrValue } from '../utils/NodeToMapListOrValue';
import { Converter } from './Converter';

export class UnknownConverter implements Converter {
  convert(node: BlueNode) {
    return NodeToMapListOrValue.get(node);
  }
}
