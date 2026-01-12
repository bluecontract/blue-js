import { BlueNode } from '../../model';
import { NodeTransformer } from '../NodeTransformer';
import type { BlueIdMapper } from '../../types/BlueIdMapper';

export function normalizeNodeBlueIds(
  node: BlueNode,
  blueIdMapper?: BlueIdMapper,
): BlueNode {
  if (!blueIdMapper) {
    return node;
  }

  return NodeTransformer.transform(node, (current) => {
    normalizeTypeField(
      () => current.getType(),
      (value) => current.setType(value),
      blueIdMapper,
    );
    normalizeTypeField(
      () => current.getItemType(),
      (value) => current.setItemType(value),
      blueIdMapper,
    );
    normalizeTypeField(
      () => current.getKeyType(),
      (value) => current.setKeyType(value),
      blueIdMapper,
    );
    normalizeTypeField(
      () => current.getValueType(),
      (value) => current.setValueType(value),
      blueIdMapper,
    );
    return current;
  });
}

function normalizeTypeField(
  getter: () => BlueNode | undefined,
  setter: (value: BlueNode | undefined) => void,
  blueIdMapper: BlueIdMapper,
): void {
  const typeNode = getter();
  if (!typeNode || typeNode.isInlineValue()) {
    return;
  }
  const blueId = typeNode.getBlueId();
  if (!blueId) {
    return;
  }
  const mapped = blueIdMapper.toCurrentBlueId(blueId);
  if (mapped !== blueId) {
    setter(typeNode.clone().setBlueId(mapped));
  }
}
