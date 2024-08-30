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

export interface ContractChess extends Contract {
  properties: {
    chessboard: BlueObjectStringValue;
    playerToMove: {
      value: 'White' | 'Black';
    };
    winner: {
      value: 'White' | 'Black' | 'None';
    };
    draw: BlueObjectBooleanValue;
    gameOver: BlueObjectBooleanValue;
  };
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
