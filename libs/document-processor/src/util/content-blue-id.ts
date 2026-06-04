import { Blue, BlueIdCalculator, BlueNode } from '@blue-labs/language';

export function calculateContentBlueId(node: BlueNode): string {
  return BlueIdCalculator.calculateBlueIdSync(node);
}

export function calculateRuntimeContentBlueId(
  blue: Blue,
  node: BlueNode,
): string {
  try {
    return calculateContentBlueId(node);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('"blueId" nodes must be reference-only')) {
      throw error;
    }
    return blue.calculateBlueIdSync(node);
  }
}
