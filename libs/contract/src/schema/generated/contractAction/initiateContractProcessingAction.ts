import { BlueObject } from '@blue-company/language';
import { ContractAction } from './contractAction';
import { Contract } from '../contract/contract';
import { ContractBlueIds } from '../blueIds';
import { TimelineEntry } from '../timeline/timelineEntry';

export interface InitiateContractProcessingAction extends ContractAction {
  type?: BlueObject & {
    name?: 'Initiate Contract Processing Action';
    blueId?: ContractBlueIds['InitiateContractProcessingAction'];
  };
  contract?: Contract;
  initiateContractEntry?: TimelineEntry;
}
