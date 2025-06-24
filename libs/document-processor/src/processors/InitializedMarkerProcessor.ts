import { blueIds } from '@blue-repository/core-dev';
import { ContractProcessor } from '../types';

export class InitializedMarkerProcessor implements ContractProcessor {
  readonly contractType = 'Initialized Marker';
  readonly contractBlueId = blueIds['Initialized Marker'];
  readonly role = 'marker';

  supports(): boolean {
    return false;
  }

  handle(): void {
    return;
  }
}
