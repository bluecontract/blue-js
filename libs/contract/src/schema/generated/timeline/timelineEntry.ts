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
  timeline?: BlueObjectStringValue;
  timelinePrev?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  threadPrev?: BlueObjectStringValue;
  message?: BlueObject;
  signature?: BlueObjectStringValue;
}
