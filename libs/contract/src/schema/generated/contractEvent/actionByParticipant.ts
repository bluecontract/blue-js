import { BlueObject } from '@blue-company/language';
import { ContractEvent } from './contractEvent';
import { Participant } from '../contract/contract';
import { ContractAction } from '../contractAction/contractAction';

export interface ActionByParticipantEvent extends ContractEvent {
  type?: BlueObject & {
    name: 'Action by Participant';
  };
  participant: Participant;
  action: ContractAction;
}
