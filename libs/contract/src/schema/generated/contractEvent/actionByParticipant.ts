import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';
import { InitiateContractAction } from '../contractAction/initiateContractAction';

export interface ActionByParticipantEvent extends BaseBlueObject {
  type?: BlueObject & {
    name: 'Action by Participant';
  };
  participant: BlueObjectStringValue;
  action: InitiateContractAction;
}
