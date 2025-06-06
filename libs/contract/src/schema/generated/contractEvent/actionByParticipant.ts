import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-labs/language';
import { InitiateContractAction } from '../contractAction/initiateContractAction';

export interface ActionByParticipantEvent extends BaseBlueObject {
  type?: BlueObject & {
    name: 'Action by Participant';
  };
  participant: BlueObjectStringValue;
  action: InitiateContractAction;
}
