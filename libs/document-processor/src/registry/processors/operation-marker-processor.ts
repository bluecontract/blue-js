import type { OperationMarker } from '../../model/index.js';
import { conversationBlueIds } from '../../repository/semantic-repository.js';
import type { MarkerProcessor } from '../types.js';
import { operationMarkerSchema } from '../../model/index.js';

export class OperationMarkerProcessor implements MarkerProcessor<OperationMarker> {
  readonly kind = 'marker' as const;
  readonly blueIds = [conversationBlueIds['Conversation/Operation']] as const;
  readonly schema = operationMarkerSchema;
}
