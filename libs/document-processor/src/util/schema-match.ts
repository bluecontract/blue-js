import type { Blue, BlueNode } from '@blue-labs/language';
import type { ZodType } from 'zod';

export function findSchemaMatch<T>(
  blue: Blue,
  node: BlueNode,
  schemas: ReadonlyMap<string, ZodType<T>>,
): ZodType<T> | null {
  for (const [blueId, schema] of schemas.entries()) {
    if (blue.isTypeOfBlueId(node, blueId)) {
      return schema;
    }
  }
  return null;
}
