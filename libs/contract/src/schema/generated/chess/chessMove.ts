import { BlueObject, BlueObjectStringValue } from '@blue-labs/language';

import { BaseBlueObject } from '@blue-labs/language';
import { ChessBlueIds } from '../blueIds';

export interface ChessMove extends BaseBlueObject {
  type?: BlueObject & {
    name?: 'Chess Move';
    blueId?: ChessBlueIds['ChessMove'];
  };
  from?: BlueObjectStringValue;
  to?: BlueObjectStringValue;
}
