import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';

export interface TimelineEntryBlueObject extends BaseBlueObject {
  id: BlueObjectStringValue;
  created?: unknown;
  timeline?: BlueObjectStringValue;
  timelinePrev?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  threadPrev?: BlueObjectStringValue;
  message: BlueObject;
  signature: BlueObjectStringValue;
}
