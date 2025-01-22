import { BlueNode } from '../model';
import { Converter } from './Converter';

export class AnyConverter implements Converter {
  convert(node: BlueNode) {
    return node;
  }
}
