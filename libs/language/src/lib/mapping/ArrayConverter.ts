import { BlueNode } from '../model';
import { Converter } from './Converter';
import { NodeToObjectConverter } from './NodeToObjectConverter';
import { ArrayCardinality, arrayOutputType, ZodArray, ZodTypeAny } from 'zod';

export class ArrayConverter implements Converter {
  constructor(private readonly nodeToObjectConverter: NodeToObjectConverter) {}

  convert<T extends ZodTypeAny, Cardinality extends ArrayCardinality = 'many'>(
    node: BlueNode,
    targetType: ZodArray<T, Cardinality>,
  ) {
    const items = node.getItems();
    if (!items) {
      return undefined;
    }

    const elementSchema = targetType.element;
    const result = items.map((item) =>
      this.nodeToObjectConverter.convert(item, elementSchema),
    );
    return result as arrayOutputType<T, Cardinality>;
  }
}
