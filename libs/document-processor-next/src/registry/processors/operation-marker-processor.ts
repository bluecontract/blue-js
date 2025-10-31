import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

import type { OperationMarker } from '../../model/index.js';
import type { MarkerProcessor } from '../types.js';
import { operationMarkerSchema } from '../../model/index.js';

export class OperationMarkerProcessor
  implements MarkerProcessor<OperationMarker>
{
  readonly kind = 'marker' as const;
  readonly blueIds = [conversationBlueIds['Operation']] as const;
  readonly schema = operationMarkerSchema;
}
