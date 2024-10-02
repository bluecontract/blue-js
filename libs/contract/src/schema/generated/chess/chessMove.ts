import { BlueObject, BlueObjectStringValue } from '@blue-company/language';

import { BaseBlueObject } from '@blue-company/language';
import { ChessBlueIds } from '../blueIds';

export interface ChessMove extends BaseBlueObject {
  type?: BlueObject & {
    name?: 'Chess Move';
    blueId?: ChessBlueIds['ChessMove'];
  };
  from?: BlueObjectStringValue;
  to?: BlueObjectStringValue;
}
