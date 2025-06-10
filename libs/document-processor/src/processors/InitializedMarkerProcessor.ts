import { mockBlueIds } from '../mocks/blueIds';
import { ContractProcessor } from '../types';

export class InitializedMarkerProcessor implements ContractProcessor {
  readonly contractType = 'Initialized Marker';
  readonly contractBlueId = mockBlueIds['Initialized Marker'];
  readonly role = 'marker';

  supports(): boolean {
    return false;
  }

  handle(): void {
    return;
  }
}
