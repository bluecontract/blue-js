import { BlueObject } from '@blue-company/language';
import { ContractAction } from './contractAction';
import { Contract } from '../contract/contract';

export interface InitiateContractAction extends ContractAction {
  type?: BlueObject & {
    name: 'Initiate Contract';
  };
  contract: Contract;
}
