import { BlueNode } from '@blue-labs/language';

export function isBexExpressionNode(node: BlueNode): boolean {
  const properties = node.getProperties();
  if (!properties) {
    return false;
  }

  // Blue metadata such as node.getType() is not an ordinary property here.
  // A real sibling property must still prevent single-expression detection.
  const keys = Object.keys(properties);
  return keys.length === 1 && keys[0].startsWith('$');
}
