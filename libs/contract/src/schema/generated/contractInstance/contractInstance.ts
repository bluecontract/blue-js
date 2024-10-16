import { BlueObjectNumberValue } from '@blue-company/language';
import { BaseBlueObject } from '@blue-company/language';
import { Contract } from '../contract/contract';

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

export interface ContractInstanceBlueObject extends BaseBlueObject {
  id: BlueObjectNumberValue;
  contractState: Contract;
  processingState: ProcessingStateBlueObject;
}

export interface ProcessingStateBlueObject extends BaseBlueObject {
  startedWorkflowCount: BlueObjectNumberValue;
  startedLocalContractCount: BlueObjectNumberValue;
  localContractInstances?: ContractInstanceBlueObject[];
}
