import { BlueObject } from '@blue-company/language';
import { ContractAction } from './contractAction';
import { Contract } from '../contract/contract';
import { ContractBlueIds } from '../blueIds';

export interface InitiateContractAction extends ContractAction {
  type?: BlueObject & {
    name?: 'Initiate Contract Action';
    blueId?: ContractBlueIds['InitiateContractAction'];
  };
  contract: Contract;
}
