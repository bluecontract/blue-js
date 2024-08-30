import { BaseBlueObject, BlueObject } from '@blue-company/language';

export interface WorkflowStepObjectList extends BaseBlueObject {
  items?: WorkflowStep[];
}

export type WorkflowStep = BlueObject;
