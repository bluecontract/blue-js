/* eslint-disable @typescript-eslint/no-empty-interface */
export interface BlueObject {
  blueId?: string;
  name?: string;
  description?: string;
  type?: BlueObject;
  value?: string | number | boolean | null;
  items?: BlueObject[];
  [k: string]: unknown;
}

// without index signature
export interface BaseBlueObject {
  blueId?: string;
  name?: string;
  description?: string;
  type?: BlueObject;
}

export interface BlueObjectStringValue extends BaseBlueObject {
  value?: string;
}

export interface BlueObjectBooleanValue extends BaseBlueObject {
  value?: boolean;
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
  trigger?: EventBlueObject;
}

export interface EventBlueObject extends BlueObject {}

export interface Event extends BaseBlueObject {}

export interface Action extends BaseBlueObject {}

export interface InitiateContractAction extends Action {
  type?: BlueObject & {
    name: 'Initiate Contract';
  };
  contract: Contract;
}

export interface ActionByParticipantEvent extends Event {
  type?: BlueObject & {
    name: 'Action by Participant';
  };
  participant: Participant;
  action: Action;
}

export interface WorkflowStepObjectList extends BaseBlueObject {
  items?: WorkflowStep[];
}

export type WorkflowStep = BlueObject;

export interface ParticipantObjectList extends BaseBlueObject {
  items?: Participant[];
}

export type ContractPhoto = BlueObjectStringValue;

export interface Participant extends BaseBlueObject {
  type?: BlueObject & {
    name?: 'Participant';
  };
  timeline?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  timelineSource?: TimelineEntryBlueObject;
}

export type ContractsListObject = BlueObject;

export interface ContractInstance {
  id: number;
  contractState: Contract;
  processingState: ProcessingState;
}

export interface ProcessingState {
  startedWorkflowCount: number;
  startedLocalContractCount: number;
  localContractInstances?: ContractInstance[];
}

export interface TimelineEntryBlueObject extends BaseBlueObject {
  id: BlueObjectStringValue;
  created?: unknown;
  timeline?: BlueObjectStringValue;
  timelinePrev?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  threadPrev?: BlueObjectStringValue;
  message: BlueObject;
  signature: BlueObjectStringValue;
}

export type InitialTimelineBlueMessageType = BlueObject & {
  name: 'Timeline by Timeline.blue';
};

export interface InitialTimelineBlueMessage extends BaseBlueObject {
  type?: InitialTimelineBlueMessageType;
  timelineAlias: BlueObjectStringValue;
  avatar?: BlueObjectStringValue;
  signingMethod?: unknown;
}
