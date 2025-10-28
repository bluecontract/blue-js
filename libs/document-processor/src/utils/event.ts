import { BlueNode } from '@blue-labs/language';
import { deepFreeze } from '@blue-labs/shared-utils';

import { EventNodePayload } from '../types';

/**
 * Creates an immutable copy of an event payload to guarantee read-only delivery.
 */
export function cloneAndFreezeEventPayload(
  payload: EventNodePayload
): EventNodePayload {
  if (payload instanceof BlueNode) {
    const cloned = payload.clone();
    return deepFreeze(cloned);
  }

  return deepFreeze(payload);
}
