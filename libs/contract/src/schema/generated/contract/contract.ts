import {
  BaseBlueObject,
  BlueObject,
  BlueObjectBooleanValue,
  BlueObjectStringValue,
} from '@blue-company/language';
import { WorkflowStepObjectList } from '../workflowStep/workflowStep';
import { ContractEventBlueObject } from '../contractEvent/contractEvent';
import { TimelineEntryBlueObject } from '../timeline/timelineEntry';

export type ParticipantType = BlueObject & {
  name?: 'Participant';
};

export interface Participant extends BaseBlueObject {
  type?: ParticipantType;
  timeline?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  timelineSource?: TimelineEntryBlueObject;
}

export interface ParticipantObjectList extends BaseBlueObject {
  items?: Participant[];
}

export interface ContractMessaging extends BaseBlueObject {
  participants?: BlueObject;
}

export interface Contract extends BaseBlueObject {
  participants?: {
    [k: string]: ParticipantObjectList;
  };
  workflows?: WorkflowObjectList;
  properties?: BlueObject;
  photo?: ContractPhoto;
  contracts?: ContractsListObject;
  messaging?: ContractMessaging;
}

export interface WorkflowObjectList extends BaseBlueObject {
  items?: Workflow[];
}

export interface Workflow extends BaseBlueObject {
  steps?: WorkflowStepObjectList;
  trigger?: ContractEventBlueObject;
}

export type ContractPhoto = BlueObjectStringValue;

export type ContractsListObject = BlueObject;

export interface LocalContract extends BaseBlueObject {
  id: {
    type?: BlueObject & {
      blueId: 'DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8';
    };
    value?: number;
  };
  type?: BlueObject & {
    blueId: '6gBMYGeWw1Cutbsrzj3c98RH4VrSJNvPsgZ4F4A19i3f';
  };
}
