import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import {
  actorPolicyMarkerSchema,
  type ActorPolicyMarker,
} from '../../model/index.js';
import type { MarkerProcessor } from '../types.js';

export class ActorPolicyMarkerProcessor implements MarkerProcessor<ActorPolicyMarker> {
  readonly kind = 'marker' as const;
  readonly blueIds = [
    conversationBlueIds['Conversation/Actor Policy'],
  ] as const;
  readonly schema = actorPolicyMarkerSchema;
}
