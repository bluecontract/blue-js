import { type Blue, BlueNode } from '@blue-labs/language';
import type { ZodType, ZodTypeDef } from 'zod';

export function nodeToSchemaOutputWithMissingTypeFallback<
  Output = unknown,
  Def extends ZodTypeDef = ZodTypeDef,
  Input = Output,
>(blue: Blue, node: BlueNode, schema: ZodType<Output, Def, Input>): Output {
  try {
    return blue.nodeToSchemaOutput(node, schema);
  } catch (error) {
    if (!isMissingTypeContentError(error)) {
      throw error;
    }
    return nodeToSchemaOutputWithoutTypeResolution(node, schema);
  }
}

function nodeToSchemaOutputWithoutTypeResolution<
  Output = unknown,
  Def extends ZodTypeDef = ZodTypeDef,
  Input = Output,
>(node: BlueNode, schema: ZodType<Output, Def, Input>): Output {
  return schema.parse(nodeToFallbackObject(node)) as Output;
}

function isMissingTypeContentError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^No content found for blueId: /.test(error.message)
  );
}

function nodeToFallbackObject(node: BlueNode, propertyKey?: string): unknown {
  if (shouldPreserveBlueNode(propertyKey)) {
    return node.clone();
  }
  const items = node.getItems();
  if (items) {
    if (propertyKey === 'triggeredEvents') {
      return items.map((item) => item.clone());
    }
    return items.map((item) => nodeToFallbackObject(item, propertyKey));
  }
  const properties = node.getProperties();
  if (properties) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      result[key] = nodeToFallbackObject(value, key);
    }
    return result;
  }
  return node.getValue();
}

function shouldPreserveBlueNode(propertyKey: string | undefined): boolean {
  return (
    propertyKey === 'event' ||
    propertyKey === 'payload' ||
    propertyKey === 'val' ||
    propertyKey === 'before' ||
    propertyKey === 'after'
  );
}
