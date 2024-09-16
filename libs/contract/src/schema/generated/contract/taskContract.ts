import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';
import { Contract, LocalContract } from './contract';

export interface AssistantMessage extends BaseBlueObject {
  type?: BlueObject & {
    name?: 'Assistant Message';
    blueId?: '2Dw47cJMtpB6BhRkA6DkAqrgc3NKFcHHoqwUy9z3Ts1x';
  };
  message?: BlueObjectStringValue;
  priority?: BlueObjectStringValue;
}

export interface UserMessage extends BaseBlueObject {
  type?: BlueObject & {
    name?: 'User Message';
  };
  message?: BlueObjectStringValue;
}

export interface ConversationObjectList extends BaseBlueObject {
  type?: BlueObject & {
    blueId?: 'G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB';
  };
  items?: BlueObject[];
}

export interface TaskContract extends Contract {
  properties: {
    conversation: ConversationObjectList;
    actualTask: LocalContract;
  };
}
