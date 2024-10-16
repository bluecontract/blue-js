import { TimelineEntry } from '../timeline/timelineEntry';
import { ContractInstanceBlueObject } from '../contractInstance/contractInstance';
import {
  BaseBlueObject,
  BlueObject,
  BlueObjectNumberValue,
} from '@blue-company/language';
import { ContractBlueIds } from '../blueIds';

export interface ContractUpdateAction extends BaseBlueObject {
  type?: BlueObject & {
    name?: 'Contract Update Action';
    blueId?: ContractBlueIds['ContractUpdateAction'];
  };
  contractInstance?: ContractInstanceBlueObject;
  contractInstancePrev?: BaseBlueObject;
  epoch?: BlueObjectNumberValue;
  emittedEvents?: BlueObject;
  initiateContractEntry?: TimelineEntry;
  initiateContractProcessingEntry?: TimelineEntry;
}
