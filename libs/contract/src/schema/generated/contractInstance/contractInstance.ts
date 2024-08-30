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
