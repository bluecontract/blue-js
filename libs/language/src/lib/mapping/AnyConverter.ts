import { BlueNode } from '../model';
import { NodeToMapListOrValue } from '../utils';
import { Converter } from './Converter';

export class AnyConverter implements Converter {
  convert(node: BlueNode) {
    return NodeToMapListOrValue.get(node);
  }
}
