import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';

export interface TimelineEntry extends BaseBlueObject {
  timeline?: BlueObjectStringValue;
  timelinePrev?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  threadPrev?: BlueObjectStringValue;
  message: BlueObject;
  signature: BlueObjectStringValue;
}
