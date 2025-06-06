import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-labs/language';
import { TimelineBlueIds } from '../blueIds';

export type InitialTimelineBlueMessageType = BlueObject & {
  name?: 'Timeline by Timeline.blue';
  blueId?: TimelineBlueIds['TimelineByTimelineBlue'];
};

export interface InitialTimelineBlueMessage extends BaseBlueObject {
  type?: InitialTimelineBlueMessageType;
  timelineAlias: BlueObjectStringValue;
  website?: BlueObjectStringValue;
  phone?: BlueObjectStringValue;
  about?: BlueObjectStringValue;
  avatar?: BlueObjectStringValue;
  instagram?: BlueObjectStringValue;
  signingMethod?: unknown;
  email?: BlueObjectStringValue;
}
