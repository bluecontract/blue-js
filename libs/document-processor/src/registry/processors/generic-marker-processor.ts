import { blueIds as coreBlueIds } from '@blue-repository/types/packages/core/blue-ids';

import { markerContractBaseSchema } from '../../model/shared/index.js';
import type { MarkerContractBase } from '../../model/shared/index.js';
import type { MarkerProcessor } from '../types.js';

export class GenericMarkerProcessor implements MarkerProcessor<MarkerContractBase> {
  readonly kind = 'marker' as const;
  readonly blueIds = [coreBlueIds['Core/Marker']] as const;
  readonly schema = markerContractBaseSchema;
}
