import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';
import { WorkflowStepObjectList } from '../workflowStep/workflowStep';
import { TimelineEntry } from '../timeline/timelineEntry';
import { ContractBlueIds, DefaultBlueIds } from '../blueIds';
import { ExpectEventStep } from '../workflowStep/expectEventStep';

export type ParticipantType = BlueObject & {
  name?: 'Participant';
};

export interface Participant extends BaseBlueObject {
  type?: ParticipantType;
  timeline?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  timelineSource?: TimelineEntry;
}

export interface ParticipantObjectList extends BaseBlueObject {
  items?: Participant[];
}

export interface ContractMessaging extends BaseBlueObject {
  participants?: BlueObject;
}

export type ContractType = BlueObject & {
  blueId: ContractBlueIds['Contract'] | ContractBlueIds['GenericContract'];
};

export interface Contract extends BaseBlueObject {
  // type?: ContractType;
  participants?: {
    [k: string]: ParticipantObjectList;
  };
  workflows?: WorkflowObjectList;
  properties?: BlueObject;
  photo?: ContractPhoto;
  contracts?: ContractsListObject;
  messaging?: ContractMessaging;
  subscriptions?: BlueObject;
}

export interface WorkflowObjectList extends BaseBlueObject {
  items?: Workflow[];
}

export interface Workflow extends BaseBlueObject {
  steps?: WorkflowStepObjectList;
  trigger?: ExpectEventStep;
}

export type ContractPhoto = BlueObjectStringValue;

export type ContractsListObject = BlueObject;

export interface LocalContract extends BaseBlueObject {
  id?: {
    type?: BlueObject & {
      blueId: DefaultBlueIds['Integer'];
    };
    value?: number;
  };
  type?: BlueObject & {
    blueId: ContractBlueIds['LocalContract'];
  };
}
