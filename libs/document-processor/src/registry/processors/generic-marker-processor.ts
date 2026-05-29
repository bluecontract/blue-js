import { markerContractBaseSchema } from '../../model/shared/index.js';
import type { MarkerContractBase } from '../../model/shared/index.js';
import { blueIds as defaultBlueIds } from '../../repository/semantic-repository.js';
import type { MarkerProcessor } from '../types.js';

export class GenericMarkerProcessor implements MarkerProcessor<MarkerContractBase> {
  readonly kind = 'marker' as const;
  readonly blueIds = [defaultBlueIds['Marker']] as const;
  readonly schema = markerContractBaseSchema;
}
