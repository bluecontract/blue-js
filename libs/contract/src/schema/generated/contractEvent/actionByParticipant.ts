import { BlueObject, BlueObjectStringValue } from '@blue-company/language';
import { ContractEvent } from './contractEvent';
import { InitiateContractAction } from '../contractAction/initiateContractAction';

export interface ActionByParticipantEvent extends ContractEvent {
  type?: BlueObject & {
    name: 'Action by Participant';
  };
  participant: BlueObjectStringValue;
  action: InitiateContractAction;
}
