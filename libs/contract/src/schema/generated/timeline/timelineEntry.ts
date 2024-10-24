import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';
import { ContractBlueIds } from '../blueIds';

export interface TimelineEntry extends BaseBlueObject {
  type?: BlueObject & {
    name?: 'Timeline Entry';
    blueId?: ContractBlueIds['TimelineEntry'];
  };
  timeline?: BaseBlueObject;
  timelinePrev?: BaseBlueObject;
  thread?: BaseBlueObject;
  threadPrev?: BaseBlueObject;
  message?: BlueObject;
  signature?: BlueObjectStringValue;
}
