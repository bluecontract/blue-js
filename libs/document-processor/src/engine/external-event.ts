import { Blue, BlueNode, ResolvedBlueNode } from '@blue-labs/language';

export function ingestExternalEvent(
  blue: Blue,
  event: BlueNode,
): ResolvedBlueNode {
  if (event.isResolved()) {
    return blue.createResolvedNode(event);
  }
  return blue.resolve(event);
}
