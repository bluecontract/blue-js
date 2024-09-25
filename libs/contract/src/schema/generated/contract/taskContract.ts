import { BaseBlueObject, BlueObject } from '@blue-company/language';
import { Contract, LocalContract } from './contract';
import { DefaultBlueIds } from '../blueIds';

export interface ConversationObjectList extends BaseBlueObject {
  type?: BlueObject & {
    blueId?: DefaultBlueIds['List'];
  };
  items?: BlueObject[];
}

export interface TaskContract extends Contract {
  properties: {
    conversation: ConversationObjectList;
    actualTask: LocalContract;
  };
}
