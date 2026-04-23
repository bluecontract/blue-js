import { BlueNode } from '../model/Node';
import { MergeReverser } from './MergeReverser';

export class Minimizer {
  private readonly reverser: MergeReverser;

  constructor(reverser: MergeReverser = new MergeReverser()) {
    this.reverser = reverser;
  }

  public minimize(node: BlueNode): BlueNode {
    return this.reverser.reverse(node);
  }
}
