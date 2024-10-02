import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';

export interface UnsignedTimelineEntry extends BaseBlueObject {
  timeline?: BlueObjectStringValue;
  timelinePrev?: BlueObjectStringValue;
  thread?: BlueObjectStringValue;
  threadPrev?: BlueObjectStringValue;
  message: BlueObject;
}

export interface TimelineEntry extends UnsignedTimelineEntry {
  signature: BlueObjectStringValue;
}
