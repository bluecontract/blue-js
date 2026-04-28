import {
  actorPolicyMarkerSchema,
  type ActorPolicyMarker,
} from '../../model/index.js';
import { conversationBlueIds } from '../../repository/semantic-repository.js';
import type { MarkerProcessor } from '../types.js';

export class ActorPolicyMarkerProcessor implements MarkerProcessor<ActorPolicyMarker> {
  readonly kind = 'marker' as const;
  readonly blueIds = [
    conversationBlueIds['Conversation/Actor Policy'],
  ] as const;
  readonly schema = actorPolicyMarkerSchema;
}
