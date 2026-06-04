import { Blue, BlueNode, ResolvedBlueNode } from '@blue-labs/language';

export function ingestExternalEvent(
  blue: Blue,
  event: BlueNode,
): ResolvedBlueNode {
  return blue.createResolvedNode(event);
}
