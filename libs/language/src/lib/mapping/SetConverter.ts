import { BlueNode } from '../model';
import { Converter } from './Converter';
import { NodeToObjectConverter } from './NodeToObjectConverter';
import { ZodSet, ZodTypeAny } from 'zod';

export class SetConverter implements Converter {
  constructor(private readonly nodeToObjectConverter: NodeToObjectConverter) {}

  convert<Value extends ZodTypeAny = ZodTypeAny>(
    node: BlueNode,
    targetType: ZodSet<Value>
  ) {
    const items = node.getItems();
    if (!items) {
      return undefined;
    }
    const elementSchema = targetType._def.valueType;
    const result = items.map((item) =>
      this.nodeToObjectConverter.convert(item, elementSchema)
    );
    return new Set(result) as Set<Value['_output']>;
  }
}
