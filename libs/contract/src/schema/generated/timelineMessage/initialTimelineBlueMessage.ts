import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';

export type InitialTimelineBlueMessageType = BlueObject & {
  name: 'Timeline by Timeline.blue';
};

export interface InitialTimelineBlueMessage extends BaseBlueObject {
  type?: InitialTimelineBlueMessageType;
  timelineAlias: BlueObjectStringValue;
  avatar?: BlueObjectStringValue;
  signingMethod?: unknown;
}
