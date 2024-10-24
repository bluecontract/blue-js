import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-company/language';

export interface WorkflowStepObjectList extends BaseBlueObject {
  items?: BlueObject[];
}

export interface WorkflowStep extends BaseBlueObject {
  condition?: BlueObjectStringValue;
}
