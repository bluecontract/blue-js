import { BlueNode } from '../model';
import { Converter } from './Converter';
import { OutputTypeOfTupleWithRest, ZodTuple, ZodTypeAny } from 'zod';
import { NodeToObjectConverter } from './NodeToObjectConverter';

export class TupleConverter implements Converter {
  constructor(private readonly nodeToObjectConverter: NodeToObjectConverter) {}

  convert<
    T extends [ZodTypeAny, ...ZodTypeAny[]] | [] = [
      ZodTypeAny,
      ...ZodTypeAny[]
    ],
    Rest extends ZodTypeAny | null = null
  >(node: BlueNode, targetType: ZodTuple<T, Rest>) {
    const items = node.getItems();
    if (!items) {
      return undefined;
    }

    const targetTypeItems = targetType.items;
    const result = items.map((item, index) =>
      this.nodeToObjectConverter.convert(item, targetTypeItems[index])
    );

    return result as OutputTypeOfTupleWithRest<T, Rest>;
  }
}
